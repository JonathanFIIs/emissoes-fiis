const SHEET_ID = "1Ken5OyVxIJ8yOnyYYOSc4nkmoxPxJCxOjXPmza_6JM8";
const GID = "1423935003";

const csvUrl = () => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

let currentPage = 1;
let itemsPerPage = 50;

const demoOffers = [{
  ticker: "FALHA", nome: "Erro", emissao: "-", status: "Erro",
  valor: "-", precoSubscricao: "-", fator: "-", dataBase: "-", ordem: "1",
  detalhesOferta: [], cronograma: [], documentos: []
}];

const normalize = (value) => (value ? String(value).trim() : "");
const key = (value) => normalize(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const COLUNAS_DETALHES = [
    "Tipo de Oferta", "Montante Inicial", "Data Base", "Fator de Proporção",
    "Valor da Cota Emitida", "Custo da Oferta/Cota", "Custo (%) / Valor Emissão",
    "Preço de Subscrição", "Preço no Secundário", "Negociação do Direito de Preferência?", 
    "Fase Atual", "Data de Conclusão da Oferta:", "Montante Captado:", 
    "Captação / Oferta", "Observações sobre a Oferta"
];

const COLUNAS_CRONOGRAMA = [
    "Data Base", "Direito de preferência - Inicio do prazo na B3:",
    "Direito de preferência - Término do prazo na B3:", "Direito de preferência - Data de liquidação:",
    "Negociação dos direitos de preferência - Inicio do prazo na B3:",
    "Negociação dos direitos de preferência - Término do prazo na B3:",
    "Sobras e/ou Montate Adicional - Inicio do prazo:", "Sobras e/ou Montate Adicional - Término do prazo:",
    "Sobras e/ou Montate Adicional - Data de liquidação:", "Oferta Pública (Subscrição) - Inicio do prazo:",
    "Oferta Pública (Subscrição) Término do prazo:", "Oferta Pública - Data de liquidação:",
    "Data de Conclusão da Oferta:", "Data de Conversão das Novas Cotas:"
];

const COLUNAS_DOCUMENTOS = [
    "Fato Relevante", "Ato do Administrador", "Prospecto da Oferta", 
    "Modificação da Oferta", "Formulário de Subscrição de Cotas", 
    "Resultado Parcial da Alocação", "Anúncio de Encerramento", "Formulário de Liberação das Novas Cotas"
];

function parseCSV(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) { 
    const c = text[i], next = text[i + 1]; 
    if (c === '"' && quoted && next === '"') { cell += '"'; i++; } 
    else if (c === '"') quoted = !quoted; 
    else if (c === ',' && !quoted) { row.push(cell); cell = ""; } 
    else if ((c === '\n' || c === '\r') && !quoted) { 
      if (c === '\r' && next === '\n') i++; 
      row.push(cell); 
      if (row.some(x => normalize(x))) rows.push(row); 
      row = []; cell = ""; 
    } else cell += c; 
  } 
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function processSheetData(rows) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const rowStr = rows[i].map(key).join("");
    if (rowStr.includes("fundo") || rowStr.includes("emissao") || rowStr.includes("ticker")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(normalize);
  const dataRows = rows.slice(headerIdx + 1);

  return dataRows.map(line => {
    const getColIndexFlex = (colName) => {
        let literalIdx = headers.findIndex(h => h.trim().toLowerCase() === colName.trim().toLowerCase());
        if (literalIdx !== -1) return literalIdx;

        const kName = key(colName);
        if (!kName) return -1;
        
        let idx = headers.findIndex(h => key(h) === kName);
        if (idx !== -1) return idx;
        
        return headers.findIndex(h => {
            const hKey = key(h);
            return hKey && (hKey.includes(kName) || kName.includes(hKey));
        });
    };

    const getVal = (...colNames) => {
        for(let c of colNames) {
            let idx = getColIndexFlex(c);
            if(idx !== -1) {
                let v = normalize(line[idx]);
                if(v && v !== "—") return v;
            }
        }
        return "—";
    };

    let ticker = getVal("fundo", "ticker", "codigo");
    if (ticker === "—") return null;

    let status = getVal("status", "fase atual");
    if (!status || status === "—") return null;

    let emissao = getVal("emissao");
    let valor = getVal("valor da oferta"); 
    let precoSubscricao = getVal("preco de subscricao"); 
    let fator = getVal("fator de proporcao"); 
    let dataBase = getVal("data base"); 
    let dataConclusao = getVal("data de conclusao da oferta", "datadeconclusao");
    let ordem = getVal("#", "ordem");

    const detalhes = [];
    const crono = [];
    const docs = [];

    const populateTab = (colArray, targetArray) => {
        colArray.forEach(col => {
            const idx = getColIndexFlex(col);
            if(idx !== -1) {
                const val = normalize(line[idx]);
                if(val && val !== "—") {
                    targetArray.push({ label: col.replace(/:$/, ''), value: val });
                }
            }
        });
    };

    populateTab(COLUNAS_DETALHES, detalhes);
    populateTab(COLUNAS_CRONOGRAMA, crono);
    populateTab(COLUNAS_DOCUMENTOS, docs);

    return {
      ticker, emissao, status, valor, precoSubscricao, fator, dataBase, dataConclusao, ordem,
      detalhesOferta: detalhes,
      cronograma: crono,
      documentos: docs
    };
  }).filter(o => o !== null);
}

function render(offers, filter = "ativas", query = "") { 
  const container = document.querySelector("#offers"), empty = document.querySelector("#empty-state"); 
  container.innerHTML = ""; 
  const search = query.toLowerCase(); 
  
  let baseTitle = "Ofertas disponíveis";
  if (filter === "inativas") baseTitle = "Ofertas indisponíveis";
  else if (filter === "todas") baseTitle = "Todas as Ofertas";
  
  let filtered = offers.filter(o => {
    const statusClean = key(o.status);
    let matchFilter = filter === "todas" ? true : 
                     (filter === "ativas" ? statusClean !== "concluida" && statusClean !== "cancelada" && statusClean !== "encerrada" :
                      statusClean === "concluida" || statusClean === "cancelada" || statusClean === "encerrada");
    return matchFilter && [o.ticker, o.status].join(" ").toLowerCase().includes(search);
  });
  
  document.querySelector("#offers-title").textContent = `${baseTitle} (${filtered.length})`;
  
  filtered.sort((a, b) => {
      const statusA = key(a.status);
      const statusB = key(b.status);
      const isConcludedA = statusA.includes("concluida") || statusA.includes("encerrada");
      const isConcludedB = statusB.includes("concluida") || statusB.includes("encerrada");

      const parseDate = (dStr) => {
         if (!dStr || dStr === "—") return 0;
         const parts = dStr.split("/");
         if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]).getTime();
         return 0;
      };

      if (isConcludedA && isConcludedB) {
          let dateA = parseDate(a.dataConclusao || a.dataBase);
          let dateB = parseDate(b.dataConclusao || b.dataBase);
          if (dateA !== dateB) return dateB - dateA;
      }

      let orderA = parseFloat(a.ordem);
      let orderB = parseFloat(b.ordem);
      let isNaN_A = isNaN(orderA);
      let isNaN_B = isNaN(orderB);
      
      if (!isNaN_A && !isNaN_B) {
          if (orderA !== orderB) return orderA - orderB;
      } else if (!isNaN_A && isNaN_B) {
          return -1;
      } else if (isNaN_A && !isNaN_B) {
          return 1;
      }

      return parseDate(b.dataBase) - parseDate(a.dataBase);
  });

  empty.hidden = filtered.length > 0; 

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (currentPage > totalPages) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedItems = filtered.slice(startIdx, endIdx);

  const template = document.querySelector("#offer-template"); 
  
  paginatedItems.forEach((offer, index) => { 
    const node = template.content.cloneNode(true); 
    const card = node.querySelector(".offer-card"); 
    
    const statusClean = key(offer.status);
    const isInactive = ["concluida", "cancelada", "encerrada"].includes(statusClean);
    const isAguardando = statusClean.includes("aguardandoconclusao");
    
    if (!isInactive && !isAguardando) card.classList.add("open"); 
    
    const status = node.querySelector(".status"); 
    status.textContent = offer.status; 
    
    if (["preoferta", "aguardandoconclusao", "concluida"].some(kw => statusClean.includes(kw))) {
        status.classList.add("cinza");
    } else if (["direitodepreferencia", "sobras", "montanteadicional"].some(kw => statusClean.includes(kw))) {
        status.classList.add("verde");
    } else if (["cancelada", "encerrada"].some(kw => statusClean.includes(kw))) {
        status.classList.add("encerrada");
    }
    
    node.querySelector(".fund-mark").textContent = offer.ticker.slice(0,4); 
    node.querySelector("h3").textContent = offer.ticker; 
    
    let emissaoTexto = (offer.emissao || "").trim().replace(/\(ipo\)/gi, "");
    if (emissaoTexto && emissaoTexto !== "—") {
        if (!emissaoTexto.toLowerCase().includes("emiss")) emissaoTexto += " Emissão";
        const primeiroChar = emissaoTexto.charAt(0);
        const segundoChar = emissaoTexto.charAt(1);
        if ((primeiroChar === '1' && isNaN(parseInt(segundoChar))) || emissaoTexto.toLowerCase().includes("primeira")) emissaoTexto += " (IPO)";
    }
    node.querySelector(".manager").textContent = emissaoTexto || "—";

    let highlights = card.querySelector(".highlights");
    if (!highlights) {
        highlights = document.createElement("div");
        highlights.className = "highlights";
        card.insertBefore(highlights, card.querySelector(".card-actions"));
    }

    let fatorFormatado = offer.fator;
    if (fatorFormatado && fatorFormatado !== "—") {
        let cleanNum = String(fatorFormatado).replace(/\s/g, '').replace('%', '').replace(',', '.');
        let numParsed = parseFloat(cleanNum);
        if (!isNaN(numParsed)) {
            fatorFormatado = numParsed.toFixed(2).replace('.', ',') + "%";
        }
    }

    const metrics = [
        ["Valor da oferta", offer.valor],
        ["Preço de subscrição", offer.precoSubscricao],
        ["Fator de prop.", fatorFormatado],
        ["Data base", offer.dataBase]
    ]; 
    
    highlights.innerHTML = metrics.map(([label, value]) => `
      <div class="metric">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
      </div>
    `).join(""); 

    const details = node.querySelector(".details"); 
    const formatValue = val => (typeof val === 'string' && val.match(/^https?:\/\//)) ? `<a href="${val}" target="_blank" style="color:var(--yellow); font-weight:600;">Acessar ↗</a>` : val;
    
    const iconDet = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><rect x="3" y="5" width="2" height="2" fill="currentColor"></rect><rect x="3" y="11" width="2" height="2" fill="currentColor"></rect><rect x="3" y="17" width="2" height="2" fill="currentColor"></rect></svg>`;
    const iconCro = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
    const iconDoc = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

    const secoes = [
        { id: `detalhes-${index}`, title: 'Detalhes da Oferta', icon: iconDet, data: offer.detalhesOferta },
        { id: `cronograma-${index}`, title: 'Cronograma Resumido', icon: iconCro, data: offer.cronograma },
        { id: `documentos-${index}`, title: 'Principais Documentos da Oferta', icon: iconDoc, data: offer.documentos }
    ].filter(s => s.data && s.data.length > 0);

    let tabsNavHTML = `<div style="display:flex; justify-content:center; gap:16px; margin-bottom:8px; padding-bottom:4px;">`;
    let tabsContentHTML = `<div>`;

    const cleanToFloat = (valStr) => {
        if (!valStr || valStr === "—") return null;
        let numClean = String(valStr).replace(/[^\d,.-]/g, '').replace(',', '.');
        let parsed = parseFloat(numClean);
        return isNaN(parsed) ? null : parsed;
    };

    secoes.forEach((sec, i) => {
        const isActive = i === 0;
        const color = isActive ? 'var(--yellow)' : 'var(--muted)';
        const borderColor = isActive ? 'var(--yellow)' : 'transparent';
        
        tabsNavHTML += `<button class="tab-btn" data-target="${sec.id}" title="${sec.title}" style="background:transparent; border:none; border-bottom:2px solid ${borderColor}; padding:6px 12px; cursor:pointer; color:${color}; display:flex;">${sec.icon}</button>`;
        
        tabsContentHTML += `<div class="tab-content" id="${sec.id}" style="display:${isActive ? 'block' : 'none'};">
            ${sec.data.map(item => {
                let displayValueHTML = formatValue(item.value);
                let labelText = item.label;

                if (statusClean.includes("cancelada")) {
                    if (key(labelText).includes("datadeconclusao")) {
                        labelText = "Data de Cancelamento da Oferta";
                    } else if (key(labelText).includes("anunciodeencerramento")) {
                        labelText = "Anúncio de Cancelamento";
                    }
                }
                
                if (key(labelText) === key("Preço de Subscrição")) {
                    const subNum = cleanToFloat(item.value);
                    const secObj = offer.detalhesOferta.find(i => key(i.label) === key("Preço no Secundário"));
                    const secNum = secObj ? cleanToFloat(secObj.value) : null;
                    
                    if (subNum !== null && secNum !== null) {
                        if (subNum >= secNum) {
                            displayValueHTML = `<strong style="color:var(--red); font-weight:700;">${item.value}</strong>`;
                        } else {
                            displayValueHTML = `<strong style="color:#367d42; font-weight:700;">${item.value}</strong>`;
                        }
                    }
                }

                // ALINHAMENTO JUSTIFICADO APLICADO PARA TEXTOS LONGOS (OBSERVAÇÃO)
                const isObs = key(labelText).includes("observacoes");
                const textAlign = isObs ? "justify" : "right";
                
                return `<div style="display:flex; justify-content:space-between; gap:16px; padding:6px 0; border-bottom:1px dashed var(--line); align-items:flex-start;">
                    <strong style="color:var(--ink); font-size:12px; font-weight:600; flex:1;">${labelText}</strong>
                    <span style="color:var(--muted); text-align:${textAlign}; flex:1.8; word-break:normal; overflow-wrap:break-word; line-height:1.4;">${displayValueHTML}</span>
                </div>`;
            }).join("")}
        </div>`;
    });

    details.innerHTML = `<div style="padding-top:12px; border-top:1px solid var(--line);">${secoes.length > 0 ? tabsNavHTML + '</div>' + tabsContentHTML + '</div>' : '<p style="text-align:center;">Nenhuma informação adicional preenchida na planilha.</p>'}</div>`;

    const btns = details.querySelectorAll('.tab-btn');
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => { b.style.color = 'var(--muted)'; b.style.borderBottomColor = 'transparent'; });
        details.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        btn.style.color = 'var(--yellow)'; btn.style.borderBottomColor = 'var(--yellow)';
        details.querySelector(`#${btn.dataset.target}`).style.display = 'block';
    }));

    node.querySelector(".expand").addEventListener("click", e => { 
      const open = e.currentTarget.getAttribute("aria-expanded") === "true"; 
      e.currentTarget.setAttribute("aria-expanded", String(!open)); 
      details.hidden = open; 
    }); 
    
    container.append(node); 
  }); 

  renderPaginationControls(totalPages, offers, filter, query);
}

function renderPaginationControls(totalPages, offers, filter, query) {
  const wrapper = document.querySelector("#pagination-wrapper");
  wrapper.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pagination-container";

  if (totalPages > 1) {
    const pagesDiv = document.createElement("div");
    pagesDiv.className = "pagination-pages";

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener("click", () => {
        currentPage = i;
        render(offers, filter, query);
        document.querySelector("#offers-title").scrollIntoView({ behavior: 'smooth' });
      });
      pagesDiv.appendChild(btn);
    }
    container.appendChild(pagesDiv);
  }

  const selectorDiv = document.createElement("div");
  selectorDiv.className = "page-size-selector";
  selectorDiv.innerHTML = `
    <label for="page-size-select">Cards por página:</label>
    <select id="page-size-select">
      <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
      <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
      <option value="250" ${itemsPerPage === 250 ? 'selected' : ''}>250</option>
      <option value="500" ${itemsPerPage === 500 ? 'selected' : ''}>500</option>
    </select>
  `;

  selectorDiv.querySelector("select").addEventListener("change", (e) => {
    itemsPerPage = parseInt(e.target.value);
    currentPage = 1;
    render(offers, filter, query);
  });

  container.appendChild(selectorDiv);
  wrapper.appendChild(container);
}

async function loadOffers() { 
  try { 
    const response = await fetch(csvUrl()); 
    if (!response.ok) throw new Error(); 
    
    const parsedData = processSheetData(parseCSV(await response.text())); 
    if (parsedData.length === 0) return demoOffers;
    return parsedData;

  } catch (err) { 
    console.warn("Erro ao ler dados da planilha.");
    return demoOffers; 
  } 
}

loadOffers().then(offers => { 
  let filter = "ativas", query = ""; 
  document.querySelector("#updated-at").textContent = `Atualizado em ${new Date().toLocaleDateString("pt-BR")}`;
  
  const update = () => render(offers, filter, query); 
  
  const activeBtn = document.querySelector('[data-filter="ativas"]');
  if (activeBtn) activeBtn.classList.add("active"); 
  update(); 
  
  document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => { 
    document.querySelector(".filter.active")?.classList.remove("active"); 
    btn.classList.add("active"); 
    filter = btn.dataset.filter; 
    currentPage = 1; 
    update(); 
  })); 
  
  document.querySelector("#search-input")?.addEventListener("input", e => { 
    query = e.target.value.trim(); 
    currentPage = 1; 
    update(); 
  });
}).catch(console.error);