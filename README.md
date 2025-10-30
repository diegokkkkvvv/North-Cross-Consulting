# North-Cross-Consulting

Herramienta para generar una "master sheet" que vincule sectores industriales prioritarios con sus fracciones arancelarias (HTS/TIGIE) y determine si requieren o no aviso automático ante la Secretaría de Economía.

## Estructura del proyecto

- `config/dof_aviso_rules.yaml`: reglas base por industria, incluyendo descripciones de fracciones arancelarias y si requieren aviso.
- `scripts/generate_master_sheet.py`: script en Python que lee el archivo YAML y genera salidas en CSV, XLSX y JSON.
- `output/`: carpeta donde se escriben los archivos generados.
- `web/`: interfaz web lista para integrar en tu sitio (HTML, CSS y JS).

## Requisitos

- Python 3.10+
- [PyYAML](https://pyyaml.org/)
- [pandas](https://pandas.pydata.org/) (opcional pero necesario para generar XLSX)
- [openpyxl](https://openpyxl.readthedocs.io/) (requerido por pandas para exportar a Excel)

Para instalar las dependencias mínimas:

```bash
pip install -r requirements.txt
```

## Uso

Generar la master sheet completa a partir de las reglas predeterminadas:

```bash
python scripts/generate_master_sheet.py
```

El comando crea tres archivos en `output/`:

- `master_sheet.csv`
- `master_sheet.xlsx`
- `master_sheet.json`

Puedes personalizar rutas y formatos:

```bash
python scripts/generate_master_sheet.py \
  --rules config/dof_aviso_rules.yaml \
  --output-dir output \
  --no-json \
  --web-data-dir web/data
```

Por defecto el script copiará el JSON actualizado a `web/data/master_sheet.json`
para que la interfaz web siempre consuma la última información. Usa
`--no-web-data` si no deseas sincronizar ese archivo.

## Integración web

1. Ejecuta `python scripts/generate_master_sheet.py` para actualizar los datos
   (esto también refresca `web/data/master_sheet.json`).
2. Sirve la carpeta `web/` como un sitio estático (por ejemplo con GitHub Pages,
   Vercel o tu propio servidor). El HTML cargará automáticamente el catálogo.
3. Opcional: embebe el formulario dentro de tu página existente, reutilizando el
   HTML/CSS/JS provisto y apuntando a tu propio endpoint JSON si así lo deseas.
4. Los usuarios pueden seleccionar una industria, escribir o elegir la fracción
   arancelaria y recibir el resultado inmediato sobre el aviso automático.

## Extensión de las reglas

El archivo `config/dof_aviso_rules.yaml` puede ampliarse agregando nuevas industrias o fracciones arancelarias. Respeta la estructura existente:

```yaml
- key: identificador_unico
  name: "Nombre de la industria"
  sector: "Sector"
  description: "Descripción corta"
  notice_type: "Tipo de aviso"
  notes: "Notas aplicables"
  hts_entries:
    - code: "XXXX.XX.XX"
      description: "Descripción TIGIE"
      requires_notice: true
      rule_reference: "Referencia DOF"
      comments: "Detalles adicionales"
```

Cada vez que actualices el YAML, vuelve a ejecutar el script para regenerar la master sheet.
