#!/usr/bin/env python3
"""Generic data-contract validator for pipeline output files.

Purpose:      Validate the PRODUCT of a data pipeline, not just its process —
              a green run that produced bad data is not green. A contract JSON
              declares what a healthy output file looks like (required keys,
              record-count bounds, freshness, per-field sanity ranges); this
              tool checks a target file against it and reports EVERY violation,
              never just the first.
Inputs:       --contract <contract.json> (required); --target <path> (optional
              override of the contract's own target path); --json.
Outputs:      Violations to stdout (the tool's product; operational messages go
              through logging). Exit 0 = contract satisfied; 1 = violated;
              2 = could not evaluate (missing/malformed contract or target, or
              a malformed contract rule). "Data is bad" (1) and "couldn't
              check" (2) are different facts and are never conflated.
Dependencies: Python stdlib only (argparse, json, logging, datetime, pathlib).
              3.9-safe (future annotations; trailing-Z timestamp normalization).

Contract JSON schema — the integration spec for enrolling any pipeline:
{
  "name": "<identifier>",              # used in every output line
  "description": "<human context>",    # optional, ignored by the validator
  "target": "<path to data file>",     # relative paths resolve against CWD
                                       # (vendored contracts sit in the repo
                                       # they validate); --target overrides
  "required_keys": ["k1", ...],        # top-level keys that must exist
  "records": {                         # optional record-count bounds
    "key": "<top-level key>",          # container holding records (dict|list)
    "min_count": N, "max_count": N     # either bound optional
  },
  "freshness": {                       # optional staleness bound
    "key": "<top-level key>",          # ISO-8601 timestamp field
    "max_age_hours": H
  },
  "field_checks": [                    # optional per-field sanity ranges
    {"records_key": "<container>",     # records to scan (dict|list)
     "field": "<numeric field>",
     "aggregate": "max" | "min",       # bound the aggregate over all records
                                       # (identity-agnostic: named records
                                       # churn — e.g. the top-ranked player
                                       # changes week to week), OR:
     "record": "<record name>",        # bound one named record's field
     "min": N, "max": N,               # plausible bounds, either optional
     "note": "<provenance of bounds>"} # every bound needs a traceable origin
  ],
  "notes": [...]                       # optional provenance, ignored
}

Null-handling rule (unknown is never zero): a null/absent field value is
skipped by aggregates, never coerced to 0; a field check that finds NO numeric
values at all is a violation, not a silent pass.
"""

from __future__ import annotations  # 3.9-safe: PEP 604 unions stay unevaluated

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants — no magic numbers in logic
# ---------------------------------------------------------------------------
EXIT_SATISFIED: int = 0
EXIT_VIOLATED: int = 1
EXIT_CANNOT_EVALUATE: int = 2

_VALID_AGGREGATES = ("max", "min")

log = logging.getLogger("data_contract")


class ContractEvalError(Exception):
    """The contract could not be evaluated (exit 2) — distinct from a violation."""


def _load_json(path: Path, kind: str) -> dict:
    """Load a JSON object, mapping every failure mode to ContractEvalError."""
    if not path.is_file():
        raise ContractEvalError(f"{kind} file not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractEvalError(
            f"{kind} file unreadable or malformed: {path} ({exc})"
        ) from exc
    if not isinstance(data, dict):
        raise ContractEvalError(f"{kind} file is not a JSON object: {path}")
    return data


def _age_hours(iso_ts: object, now: datetime) -> float | None:
    """Hours between an ISO-8601 timestamp and `now`; None if unparseable.
    3.9-safe: fromisoformat rejects a trailing 'Z', so normalize it first.
    A naive timestamp is assumed UTC."""
    try:
        parsed = datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return (now - parsed).total_seconds() / 3600.0


def _check_required_keys(contract: dict, data: dict) -> list[str]:
    """One violation per declared top-level key absent from the data."""
    return [f"required key missing: '{key}'"
            for key in contract.get("required_keys", []) if key not in data]


def _get_container(data: dict, key: str, violations: list[str]) -> object:
    """The record container at `key`, or None after recording why not."""
    if key not in data:
        violations.append(f"records key missing: '{key}'")
        return None
    container = data[key]
    if not isinstance(container, (dict, list)):
        violations.append(f"records key '{key}' is not a dict or list "
                          f"(got {type(container).__name__})")
        return None
    return container


def _check_records(contract: dict, data: dict) -> list[str]:
    """Record-count bounds from the contract's `records` rule, if present."""
    rule = contract.get("records")
    if rule is None:
        return []
    violations: list[str] = []
    container = _get_container(data, rule["key"], violations)
    if container is None:
        return violations
    count = len(container)
    if "min_count" in rule and count < rule["min_count"]:
        violations.append(
            f"record count {count} below min_count {rule['min_count']}")
    if "max_count" in rule and count > rule["max_count"]:
        violations.append(
            f"record count {count} above max_count {rule['max_count']}")
    return violations


def _check_freshness(contract: dict, data: dict, now: datetime) -> list[str]:
    """Staleness bound from the contract's `freshness` rule, if present."""
    rule = contract.get("freshness")
    if rule is None:
        return []
    key = rule["key"]
    if key not in data:
        return [f"freshness key missing: '{key}'"]
    age = _age_hours(data[key], now)
    if age is None:
        return [f"freshness key '{key}' is not a parseable ISO-8601 "
                f"timestamp: {data[key]!r}"]
    if age > rule["max_age_hours"]:
        return [f"data is stale: '{key}' is {age:.1f}h old "
                f"(max {rule['max_age_hours']}h)"]
    return []


def _numeric_field_values(container: object, field: str) -> list[float]:
    """Non-null numeric values of `field` across all records. Unknown is never
    zero: null/absent/non-numeric values are skipped, not coerced."""
    records = container.values() if isinstance(container, dict) else container
    values: list[float] = []
    for rec in records:
        if isinstance(rec, dict):
            value = rec.get(field)
            # bool is an int subclass; True must not sneak in as 1
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                values.append(value)
    return values


def _bound_violations(label: str, value: float, rule: dict) -> list[str]:
    """Bound `value` by the rule's optional min/max plausibility range."""
    out: list[str] = []
    if "min" in rule and value < rule["min"]:
        out.append(f"{label} = {value} below plausible min {rule['min']}")
    if "max" in rule and value > rule["max"]:
        out.append(f"{label} = {value} above plausible max {rule['max']}")
    return out


def _check_one_field_rule(rule: dict, data: dict) -> list[str]:
    """One field_checks entry: either a named record's field, or an aggregate
    (max/min) over all records — bounded by the rule's plausibility range."""
    violations: list[str] = []
    container = _get_container(data, rule["records_key"], violations)
    if container is None:
        return violations
    field = rule["field"]
    if "record" in rule:
        rec = container.get(rule["record"]) if isinstance(container, dict) else None
        value = rec.get(field) if isinstance(rec, dict) else None
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return [f"named record '{rule['record']}' missing or its field "
                    f"'{field}' is not numeric"]
        return _bound_violations(f"{rule['record']}.{field}", value, rule)
    aggregate = rule.get("aggregate", "max")
    if aggregate not in _VALID_AGGREGATES:
        raise ContractEvalError(f"malformed contract rule: aggregate must be "
                                f"one of {_VALID_AGGREGATES}, got {aggregate!r}")
    values = _numeric_field_values(container, field)
    if not values:
        return [f"no numeric values for field '{field}' in "
                f"'{rule['records_key']}' — cannot sanity-check"]
    value = max(values) if aggregate == "max" else min(values)
    label = f"{aggregate}({rule['records_key']}[].{field})"
    return _bound_violations(label, value, rule)


def validate(contract: dict, data: dict, now: datetime) -> list[str]:
    """Every violation of `contract` by `data` — all of them, never just the
    first. A malformed contract rule (missing sub-key, wrong type, bad
    aggregate) raises ContractEvalError: that is a "couldn't check" (exit 2),
    never conflated with "data is bad" (exit 1)."""
    try:
        violations = _check_required_keys(contract, data)
        violations += _check_records(contract, data)
        violations += _check_freshness(contract, data, now)
        for rule in contract.get("field_checks", []):
            violations += _check_one_field_rule(rule, data)
    except (KeyError, TypeError, AttributeError) as exc:
        raise ContractEvalError(f"malformed contract rule: {exc!r}") from exc
    return violations


def _emit(name: str, target: Path, violations: list[str], as_json: bool) -> None:
    """Print the tool's product: every violation, then the verdict."""
    if as_json:
        print(json.dumps({"contract": name, "target": str(target),
                          "result": "FAIL" if violations else "PASS",
                          "violations": violations}, indent=2))
        return
    for violation in violations:
        print(f"VIOLATION [{name}]: {violation}")
    verdict = (f"{len(violations)} violation(s)" if violations
               else "contract satisfied")
    print(f"{name}: {verdict}")


def _emit_error(contract_path: Path, message: str, as_json: bool) -> None:
    """Print an exit-2 evaluation error (distinct from a FAIL verdict)."""
    log.error("%s", message)
    if as_json:
        print(json.dumps({"contract": str(contract_path), "result": "ERROR",
                          "error": message}, indent=2))


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a pipeline output file against a data contract")
    parser.add_argument("--contract", required=True, type=Path,
                        help="Path to the contract JSON file")
    parser.add_argument("--target", type=Path, default=None,
                        help="Override the contract's target data-file path")
    parser.add_argument("--json", action="store_true",
                        help="Emit the verdict as JSON to stdout")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    now = datetime.now(timezone.utc)
    try:
        contract = _load_json(args.contract, "contract")
        target = args.target or Path(str(contract.get("target", "")))
        if not str(target):
            raise ContractEvalError(
                "no target: contract has no 'target' and --target not given")
        data = _load_json(target, "target")
        violations = validate(contract, data, now)
    except ContractEvalError as exc:
        _emit_error(args.contract, str(exc), args.json)
        return EXIT_CANNOT_EVALUATE
    name = str(contract.get("name", args.contract.stem))
    _emit(name, target, violations, args.json)
    return EXIT_VIOLATED if violations else EXIT_SATISFIED


if __name__ == "__main__":
    raise SystemExit(main())

# CHANGELOG
# 2026-07-21  Created — generic data-contract validator (data-retrieval-loop
#             Phase 1): required keys, record-count bounds, freshness, per-field
#             sanity ranges (aggregate or named-record). Exit 0/1/2 with the
#             violated-vs-unevaluable distinction kept strict. Stdlib only,
#             3.9-safe. Source of truth for vendored copies in pipeline repos.
