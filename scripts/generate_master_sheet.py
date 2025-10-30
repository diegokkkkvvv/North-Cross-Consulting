"""Generate a master sheet that links industries, HTS codes and aviso automático requirements."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

try:
    import yaml  # type: ignore
except ImportError as exc:  # pragma: no cover - defensive import guard
    raise SystemExit(
        "PyYAML is required to run this script. Install it with `pip install pyyaml`."
    ) from exc

try:
    import pandas as pd  # type: ignore
except ImportError:
    pd = None  # type: ignore


@dataclass
class HTSEntry:
    industry_key: str
    industry_name: str
    industry_sector: str
    notice_type: str
    hts_code: str
    hts_description: str
    requires_notice: bool
    rule_reference: str
    comments: str
    notes: str

    @property
    def requires_notice_label(self) -> str:
        return "Sí" if self.requires_notice else "No"

    def to_row(self) -> List[str]:
        return [
            self.industry_name,
            self.industry_sector,
            self.notice_type,
            self.hts_code,
            self.hts_description,
            self.requires_notice_label,
            self.rule_reference,
            self.comments,
            self.notes,
            self.industry_key,
        ]


CSV_HEADER = [
    "industria",
    "sector",
    "tipo_aviso",
    "fraccion_arancelaria",
    "descripcion_hts",
    "requiere_aviso_automatico",
    "fundamento",
    "comentarios",
    "notas_industria",
    "industry_key",
]


def parse_yaml_rules(path: Path) -> Iterable[HTSEntry]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    industries = data.get("industries", [])
    if not industries:
        raise ValueError("No se encontraron industrias en el archivo YAML.")

    entries: List[HTSEntry] = []
    for industry in industries:
        key = industry.get("key")
        name = industry.get("name")
        sector = industry.get("sector")
        notice_type = industry.get("notice_type", "")
        notes = industry.get("notes", "")
        if not key or not name:
            raise ValueError("Cada industria debe tener los campos 'key' y 'name'.")

        for hts in industry.get("hts_entries", []):
            entries.append(
                HTSEntry(
                    industry_key=key,
                    industry_name=name,
                    industry_sector=sector or "",
                    notice_type=notice_type,
                    hts_code=hts.get("code", ""),
                    hts_description=hts.get("description", ""),
                    requires_notice=bool(hts.get("requires_notice", False)),
                    rule_reference=hts.get("rule_reference", ""),
                    comments=hts.get("comments", ""),
                    notes=notes,
                )
            )

    return entries


def write_csv(entries: Iterable[HTSEntry], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(CSV_HEADER)
        for entry in entries:
            writer.writerow(entry.to_row())


def write_excel(entries: Iterable[HTSEntry], output_path: Path) -> None:
    if pd is None:
        raise RuntimeError(
            "pandas es requerido para exportar a Excel. Instálalo con `pip install pandas openpyxl`."
        )

    rows = [entry.to_row() for entry in entries]
    df = pd.DataFrame(rows, columns=CSV_HEADER)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(output_path, index=False)


def write_json(entries: Iterable[HTSEntry], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = [entry.__dict__ for entry in entries]
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Genera archivos maestros (CSV, XLSX, JSON) a partir de la configuración de avisos automáticos"
        )
    )
    parser.add_argument(
        "--rules",
        type=Path,
        default=Path("config/dof_aviso_rules.yaml"),
        help="Ruta al archivo YAML con las reglas",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output"),
        help="Directorio donde se guardarán los archivos generados",
    )
    parser.add_argument(
        "--no-xlsx",
        action="store_true",
        help="No generar archivo XLSX",
    )
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="No generar archivo JSON",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="No generar archivo CSV",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    entries = list(parse_yaml_rules(args.rules))

    if not args.no_csv:
        write_csv(entries, args.output_dir / "master_sheet.csv")

    if not args.no_xlsx:
        if pd is None:
            parser.error(
                "No se pudo generar XLSX porque pandas no está instalado. Ejecuta `pip install pandas openpyxl`."
            )
        write_excel(entries, args.output_dir / "master_sheet.xlsx")

    if not args.no_json:
        write_json(entries, args.output_dir / "master_sheet.json")

    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    sys.exit(main())
