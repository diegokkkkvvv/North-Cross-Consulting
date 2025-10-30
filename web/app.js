const DATA_URL = "../output/master_sheet.json";

const industrySelect = document.querySelector("#industry-select");
const htsInput = document.querySelector("#hts-input");
const htsDatalist = document.querySelector("#hts-options");
const lookupForm = document.querySelector("#lookup-form");
const clearBtn = document.querySelector("#clear-btn");
const exportBtn = document.querySelector("#export-json");

const industrySummary = document.querySelector("#industry-summary");
const summaryIndustry = document.querySelector("#summary-industry");
const summarySector = document.querySelector("#summary-sector");
const summaryNotice = document.querySelector("#summary-notice");
const summaryNotes = document.querySelector("#summary-notes");

const resultCard = document.querySelector("#result-card");
const resultMessage = document.querySelector("#result-message");
const resultDetails = document.querySelector("#result-details");

const industryTable = document.querySelector("#industry-table");
const industryRows = document.querySelector("#industry-rows");

const state = {
  entries: [],
  industries: new Map(),
};

function normalizeCode(value) {
  return value.replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
}

function formatCode(value) {
  const digits = normalizeCode(value);
  if (digits.length !== 8) return value.trim();
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function groupByIndustry(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = entry.industry_key;
    if (!map.has(key)) {
      map.set(key, {
        meta: {
          key,
          name: entry.industry_name,
          sector: entry.industry_sector,
          noticeType: entry.notice_type,
          notes: entry.notes,
        },
        entries: [],
        normalizedMap: new Map(),
      });
    }
    const bucket = map.get(key);
    const normalizedCode = normalizeCode(entry.hts_code);
    const enriched = {
      ...entry,
      normalizedCode,
      formattedCode: formatCode(entry.hts_code),
    };
    bucket.entries.push(enriched);
    bucket.normalizedMap.set(normalizedCode, enriched);
  });
  return map;
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Error al cargar los datos (${response.status})`);
    }
    const payload = await response.json();
    state.entries = payload;
    state.industries = groupByIndustry(payload);
    populateIndustrySelect();
  } catch (error) {
    console.error(error);
    showError(`No se pudo cargar el catálogo: ${error.message}`);
  }
}

function showError(message) {
  resultCard.hidden = false;
  resultMessage.textContent = message;
  resultMessage.className = "result-message warning";
  resultDetails.innerHTML =
    "<p>Verifica que el archivo <code>output/master_sheet.json</code> esté disponible.</p>";
}

function populateIndustrySelect() {
  const fragment = document.createDocumentFragment();
  const industries = Array.from(state.industries.values())
    .map((item) => item.meta)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  industries.forEach((meta) => {
    const option = document.createElement("option");
    option.value = meta.key;
    option.textContent = meta.name;
    fragment.appendChild(option);
  });

  industrySelect.appendChild(fragment);
}

function populateHTSOptions(industryKey) {
  htsDatalist.innerHTML = "";
  if (!industryKey) {
    return;
  }
  const bucket = state.industries.get(industryKey);
  if (!bucket) return;
  const fragment = document.createDocumentFragment();
  bucket.entries
    .slice()
    .sort((a, b) => a.hts_code.localeCompare(b.hts_code))
    .forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.formattedCode;
      option.label = entry.hts_description;
      fragment.appendChild(option);
    });
  htsDatalist.appendChild(fragment);
}

function updateIndustrySummary(industryKey) {
  const bucket = state.industries.get(industryKey);
  if (!bucket) {
    industrySummary.hidden = true;
    return;
  }
  const { meta } = bucket;
  summaryIndustry.textContent = meta.name;
  summarySector.textContent = meta.sector || "—";
  summaryNotice.textContent = meta.noticeType || "—";
  summaryNotes.textContent = meta.notes || "Sin notas adicionales";
  industrySummary.hidden = false;
}

function renderResult(industryKey, rawCode) {
  const code = rawCode.trim();
  const bucket = state.industries.get(industryKey);
  if (!bucket) {
    showError("Selecciona una industria válida para continuar.");
    return;
  }

  const normalized = normalizeCode(code);
  const entry = bucket.normalizedMap.get(normalized);

  if (!entry) {
    resultCard.hidden = false;
    resultMessage.textContent =
      code
        ? `No encontramos la fracción ${formatCode(code)} en el catálogo de esta industria.`
        : "Ingresa una fracción arancelaria para consultar.";
    resultMessage.className = "result-message warning";
    resultDetails.innerHTML =
      "<p>Revisa la lista de fracciones vinculadas o verifica que la fracción corresponda al sector seleccionado.</p>";
    return;
  }

  const requiresNotice = entry.requires_notice;
  resultCard.hidden = false;
  resultMessage.textContent = requiresNotice
    ? "La fracción requiere aviso automático."
    : "La fracción no requiere aviso automático.";
  resultMessage.className = `result-message ${requiresNotice ? "warning" : "success"}`;

  resultDetails.innerHTML = `
    <p><strong>Fracción:</strong> ${entry.formattedCode}</p>
    <p><strong>Descripción:</strong> ${entry.hts_description}</p>
    <p><strong>Fundamento:</strong> ${entry.rule_reference || "N/A"}</p>
    <p><strong>Comentarios:</strong> ${entry.comments || "Sin comentarios adicionales."}</p>
  `;
}

function renderIndustryTable(industryKey) {
  const bucket = state.industries.get(industryKey);
  if (!bucket) {
    industryTable.hidden = true;
    return;
  }
  const rows = bucket.entries
    .slice()
    .sort((a, b) => a.hts_code.localeCompare(b.hts_code))
    .map((entry) => {
      const badgeClass = entry.requires_notice ? "warning" : "success";
      const badgeLabel = entry.requires_notice ? "Sí" : "No";
      return `
        <tr>
          <td>${entry.formattedCode}</td>
          <td>${entry.hts_description}</td>
          <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
          <td>${entry.rule_reference || "N/A"}</td>
        </tr>
      `;
    })
    .join("");

  industryRows.innerHTML = rows;
  industryTable.hidden = false;
}

function downloadIndustryData(industryKey) {
  const bucket = state.industries.get(industryKey);
  if (!bucket) return;
  const blob = new Blob([JSON.stringify(bucket.entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `catalogo_${industryKey}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function resetUI() {
  lookupForm.reset();
  htsDatalist.innerHTML = "";
  industrySummary.hidden = true;
  resultCard.hidden = true;
  industryTable.hidden = true;
  Array.from(industrySelect.options).forEach((option, index) => {
    option.selected = index === 0;
  });
}

industrySelect.addEventListener("change", (event) => {
  const industryKey = event.target.value;
  populateHTSOptions(industryKey);
  updateIndustrySummary(industryKey);
  renderIndustryTable(industryKey);
  resultCard.hidden = true;
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const industryKey = industrySelect.value;
  const code = htsInput.value;
  renderResult(industryKey, code);
});

clearBtn.addEventListener("click", () => {
  resetUI();
});

exportBtn.addEventListener("click", () => {
  const industryKey = industrySelect.value;
  if (!industryKey) {
    alert("Selecciona una industria para descargar su catálogo.");
    return;
  }
  downloadIndustryData(industryKey);
});

htsInput.addEventListener("input", () => {
  const industryKey = industrySelect.value;
  if (!industryKey) {
    return;
  }
  const bucket = state.industries.get(industryKey);
  if (!bucket) {
    return;
  }
  const normalized = normalizeCode(htsInput.value);
  if (bucket.normalizedMap.has(normalized)) {
    renderResult(industryKey, htsInput.value);
  }
});

loadData();
