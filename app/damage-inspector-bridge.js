/**
 * CalculAutoRent - Damage Inspector Bridge & UI Component
 * Integrează Subagentul Inspector de Daune în aplicația web.
 */

(function () {
  'use strict';

  // Injectează elementul modal în DOM dacă nu există
  function ensureModal() {
    let modal = document.getElementById('inspector-audit-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inspector-audit-modal';
      modal.innerHTML = `
        <div class="audit-modal-content">
          <div class="audit-header">
            <div class="audit-header-title">
              <span style="font-size: 24px;">🔍</span>
              <div>
                <h2 style="margin: 0; font-size: 1.15rem; font-weight: 700;">Raport Audit Dosar - Inspector Daune RCA</h2>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Subagent inteligent de clasificare, conformitate juridică și cesiuni</p>
              </div>
            </div>
            <div id="audit-status-badge-container"></div>
          </div>
          <div class="audit-body" id="audit-body-content">
            <!-- Conținut dinamic generat -->
          </div>
          <div class="audit-footer">
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-audit btn-secondary-audit" id="btn-audit-skills">
                🧠 Abilități & Memorie
              </button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-audit btn-secondary-audit" id="btn-audit-close">
                Închide
              </button>
              <button type="button" class="btn-audit btn-primary-audit" id="btn-audit-apply">
                ✓ Aplică Datele în Formular
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btn-audit-close').addEventListener('click', closeModal);
      document.getElementById('btn-audit-apply').addEventListener('click', applyDataToForm);
      document.getElementById('btn-audit-skills').addEventListener('click', showSkillsManager);
    }
    return modal;
  }

  let currentAuditResult = null;

  function openModal(auditResult) {
    currentAuditResult = auditResult;
    const modal = ensureModal();
    renderAuditReport(auditResult);
    modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('inspector-audit-modal');
    if (modal) modal.classList.remove('open');
  }

  function renderAuditReport(res) {
    const badgeContainer = document.getElementById('audit-status-badge-container');
    const bodyContent = document.getElementById('audit-body-content');

    // Status Badge
    let badgeClass = 'badge-valid';
    let badgeText = '✓ Dosar Conform';
    if (res.conformity.status === 'CRITICAL') {
      badgeClass = 'badge-critical';
      badgeText = '⚠ Neconformități Critice';
    } else if (res.conformity.status === 'WARNING') {
      badgeClass = 'badge-warning';
      badgeText = '⚡ Necesită Verificare';
    }
    badgeContainer.innerHTML = `<span class="audit-badge ${badgeClass}">${badgeText}</span>`;

    let html = '';

    // Secțiunea 1: Alerte de Conformitate (Verificări Inspector)
    if (res.conformity.issues.length > 0 || res.conformity.passed.length > 0) {
      html += `<div><div class="audit-section-title">Audit Conformitate Juridico-Administrativă</div><div style="display: flex; flex-direction: column; gap: 8px;">`;
      
      for (const issue of res.conformity.issues) {
        const alertClass = issue.severity === 'CRITICAL' ? 'alert-critical' : 'alert-warning';
        const icon = issue.severity === 'CRITICAL' ? '⛔' : '⚠️';
        html += `
          <div class="audit-alert ${alertClass}">
            <span style="font-size: 16px;">${icon}</span>
            <div>
              <b>${issue.title}</b>
              <div style="margin-top: 2px;">${issue.description}</div>
            </div>
          </div>
        `;
      }

      for (const pass of res.conformity.passed) {
        html += `
          <div class="audit-alert alert-passed">
            <span style="font-size: 16px;">✅</span>
            <div>
              <b>${pass.title}</b>
              <div style="margin-top: 2px;">${pass.description}</div>
            </div>
          </div>
        `;
      }

      html += `</div></div>`;
    }

    // Secțiunea 2: Carduri Sinteză (Păgubit, Cesiune, Reparație, Rent)
    html += `
      <div>
        <div class="audit-section-title">Date Extrase & Identificate</div>
        <div class="audit-grid">
          
          <!-- Card Păgubit -->
          <div class="audit-card">
            <div class="audit-card-title">
              <span>👤</span> Partea Păgubită
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Nume / Denumire:</span>
              <span class="audit-field-value">${res.damagedParty.nume_pagubit || '<i>Nedeterminat</i>'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Formă juridică:</span>
              <span class="audit-field-value">${res.damagedParty.is_pj ? 'Persoană Juridică (PJ)' : 'Persoană Fizică (PF)'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Auto Avariat:</span>
              <span class="audit-field-value">${res.damagedParty.marca_model || '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Nr. Înmatriculare:</span>
              <span class="audit-field-value">${res.damagedParty.numar_inmatriculare || '-'}</span>
            </div>
          </div>

          <!-- Card Cesiune de Creanță -->
          <div class="audit-card" style="${res.cession.has_cession ? 'border-color: #00634c;' : ''}">
            <div class="audit-card-title">
              <span>📑</span> Contract de Cesiune
              ${res.cession.has_cession ? '<span class="audit-badge badge-valid" style="margin-left: auto;">Identificat</span>' : '<span style="margin-left: auto; font-size: 12px; color: #94a3b8;">Fără cesiune</span>'}
            </div>
            ${res.cession.has_cession ? `
              <div class="audit-field-row">
                <span class="audit-field-label">Cesionar:</span>
                <span class="audit-field-value">${res.cession.cesionar.nume_cesionar || '-'}</span>
              </div>
              <div class="audit-field-row">
                <span class="audit-field-label">CUI Cesionar:</span>
                <span class="audit-field-value">${res.cession.cesionar.cui_cesionar || '-'}</span>
              </div>
              <div class="audit-field-row">
                <span class="audit-field-label">Cont IBAN:</span>
                <span class="audit-field-value font-mono" style="font-size: 11px;">${res.cession.cesionar.cont_iban_cesionar || '-'}</span>
              </div>
              <div class="audit-field-row">
                <span class="audit-field-label">Bancă:</span>
                <span class="audit-field-value">${res.cession.cesionar.banca_cesionar || '-'}</span>
              </div>
              <div style="margin-top: 8px; font-size: 11.5px; color: #00634c; font-weight: 600;">
                ✓ Datele cesionarului vor fi completate automat în formular.
              </div>
            ` : `
              <p style="margin: 8px 0 0; font-size: 12.5px; color: #64748b;">
                Despăgubirea se cuvine direct părții păgubite (fără cesionare de creanță).
              </p>
            `}
          </div>

          <!-- Card Reparație -->
          <div class="audit-card">
            <div class="audit-card-title">
              <span>🔧</span> Reparație & Deviz
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Service (Emitent):</span>
              <span class="audit-field-value">${res.invoicesData.reparatie.rep_emitent || '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Factură / Dată:</span>
              <span class="audit-field-value">${res.invoicesData.reparatie.rep_factura_nr || '-'} / ${res.invoicesData.reparatie.rep_factura_data || '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Total Facturat:</span>
              <span class="audit-field-value">${res.invoicesData.reparatie.valoare_desp_rep_facturata ? res.invoicesData.reparatie.valoare_desp_rep_facturata.toLocaleString('ro-RO') + ' lei' : '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Ore Tinichigerie:</span>
              <span class="audit-field-value">${res.invoicesData.reparatie.ore_tinichigerie || 0} h</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Ore Vopsitorie:</span>
              <span class="audit-field-value">${res.invoicesData.reparatie.ore_vopsitorie || 0} h</span>
            </div>
          </div>

          <!-- Card Rent -->
          <div class="audit-card">
            <div class="audit-card-title">
              <span>🚗</span> Închiriere Auto (Rent)
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Firmă Rent:</span>
              <span class="audit-field-value">${res.invoicesData.rent.rent_emitent || '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Factură / Dată:</span>
              <span class="audit-field-value">${res.invoicesData.rent.rent_factura_nr || '-'} / ${res.invoicesData.rent.rent_factura_data || '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Perioadă Rent:</span>
              <span class="audit-field-value">${res.invoicesData.rent.rent_start ? res.invoicesData.rent.rent_start + ' - ' + res.invoicesData.rent.rent_end : '-'}</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Zile Facturate:</span>
              <span class="audit-field-value">${res.invoicesData.rent.zile_facturate || 0} zile</span>
            </div>
            <div class="audit-field-row">
              <span class="audit-field-label">Tarif / zi:</span>
              <span class="audit-field-value">${res.invoicesData.rent.pret_facturat ? res.invoicesData.rent.pret_facturat.toLocaleString('ro-RO') + ' lei' : '-'}</span>
            </div>
          </div>

        </div>
      </div>
    `;

    // Secțiunea 3: Documente Clasificate
    html += `
      <div>
        <div class="audit-section-title">
          <span>Checklist Documente Identificate (${res.documents.length})</span>
          <span style="font-size: 11px; text-transform: none; font-weight: normal;">Recunoscute de Subagent</span>
        </div>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
          ${res.documents.map(d => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; background: #fff;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📄</span>
                <div>
                  <div style="font-weight: 600;">${d.name}</div>
                  <div style="font-size: 11px; color: #64748b;">Ancore: ${d.classification.matchedAnchors.slice(0, 3).join(', ') || 'Nume fișier'}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="audit-badge ${d.classification.type !== 'UNKNOWN' ? 'badge-valid' : 'badge-warning'}">
                  ${d.classification.type}
                </span>
                <button type="button" class="btn-learn-doc" data-docname="${d.name}" style="background: none; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
                  Corectează tip
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    bodyContent.innerHTML = html;

    // Atașează handlere pentru butonul "Corectează tip"
    document.querySelectorAll('.btn-learn-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docName = e.target.getAttribute('data-docname');
        teachNewPattern(docName);
      });
    });
  }

  // Funcție de injectare date în React Form
  function setNativeValue(element, value) {
    if (!element) return;
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')
      ? Object.getOwnPropertyDescriptor(element, 'value').set
      : null;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')
      ? Object.getOwnPropertyDescriptor(prototype, 'value').set
      : null;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyDataToForm() {
    if (!currentAuditResult || !currentAuditResult.formFields) return;
    const f = currentAuditResult.formFields;

    const mappings = [
      ['nume-pagubit-input', f.nume_pagubit],
      ['marca-model-input', f.marca_model],
      ['numar-inmatriculare-input', f.numar_inmatriculare],
      ['rep-factura-nr-input', f.rep_factura_nr],
      ['valoare-desp-rep-facturata-input', f.valoare_desp_rep_facturata],
      ['ora-manopera-facturata-input', f.ora_manopera_facturata],
      ['rent-factura-nr-input', f.rent_factura_nr],
      ['zile-facturate-input', f.zile_facturate],
      ['pret-facturat-input', f.pret_facturat],
      ['valoare-desp-rent-facturata-input', f.valoare_desp_rent_facturata],
      ['auto-inchiriat-marca-input', f.auto_inchiriat_marca]
    ];

    let appliedCount = 0;
    for (const [id, val] of mappings) {
      if (val !== undefined && val !== null && val !== '') {
        const el = document.querySelector(`[data-testid="${id}"]`) || document.getElementById(id);
        if (el) {
          setNativeValue(el, String(val));
          appliedCount++;
        }
      }
    }

    // Cesiune
    if (f.nume_cesionar) {
      const cesionarEl = document.querySelector('[data-testid="nume-cesionar-input"]') || document.getElementById('nume_cesionar');
      if (cesionarEl) setNativeValue(cesionarEl, f.nume_cesionar);

      const cuiCesEl = document.querySelector('[data-testid="cui-cesionar-input"]') || document.getElementById('cui_cesionar');
      if (cuiCesEl) setNativeValue(cuiCesEl, f.cui_cesionar);
    }

    closeModal();
    alert(`Inspector Daune: Datele au fost aplicate cu succes în formular! (${appliedCount} câmpuri completate automat)`);
  }

  // Funcție de învățare adaptivă (Adaptive Skill Learner)
  function teachNewPattern(docName) {
    const doc = currentAuditResult?.documents?.find(d => d.name === docName);
    if (!doc) return;

    const availableTypes = CalculAutoRentInspector.instance.store.skills.documentTypes.map(d => `${d.id} (${d.label})`).join('\n');
    const selectedType = prompt(`Alege tipul corect de document pentru „${docName}”:\n\nOpțiuni disponibile:\n${availableTypes}`, doc.classification.type);
    if (!selectedType) return;

    const cleanType = selectedType.split(' ')[0].trim().toUpperCase();
    const anchor = prompt(`Introdu un cuvânt cheie / ancoră specifică din acest document pe care subagentul să îl țină minte:`);
    if (!anchor) return;

    CalculAutoRentInspector.instance.store.recordLearnedPattern(cleanType, anchor.toUpperCase(), { filenamePattern: docName });
    alert(`Abilitate învățată! Subagentul a înregistrat ancorele noi pentru tipul „${cleanType}”.`);

    // Re-clasifică și actualizează modalul
    doc.classification.type = cleanType;
    doc.classification.matchedAnchors.push(anchor.toUpperCase());
    renderAuditReport(currentAuditResult);
  }

  function showSkillsManager() {
    const store = CalculAutoRentInspector.instance.store;
    const json = store.exportJSON();
    const action = prompt(`Manager Abilități Inspector Daune (Skills & Memory)\n\nTastază:\n1. EXPORT - pentru a copia abilitățile curente\n2. IMPORT - pentru a introduce abilități din alt calculator\n3. RESET - pentru a reveni la abilitățile implicite`, 'EXPORT');

    if (action === 'EXPORT') {
      navigator.clipboard?.writeText(json);
      alert('Abilitățile au fost copiate în clipboard (format JSON)!');
    } else if (action === 'IMPORT') {
      const input = prompt('Lipește JSON-ul cu noile abilități:');
      if (input) {
        try {
          store.importJSON(input);
          alert('Abilitățile au fost importate cu succes!');
        } catch (e) {
          alert('Eroare la import: ' + e.message);
        }
      }
    } else if (action === 'RESET') {
      if (confirm('Sigur resetezi memoria de învățare la setările din fabrică?')) {
        store.resetToDefaults();
        alert('Abilitățile au fost resetate.');
      }
    }
  }

  // Hooking în procesul de upload al fișierelor
  async function processFilesWithInspector(files) {
    if (!files || files.length === 0) return;
    const rawDocs = [];

    for (const file of files) {
      if (!/\.pdf$/i.test(file.name)) continue;
      try {
        const arrayBuffer = await file.arrayBuffer();
        let fullText = '';
        const pages = [];

        if (window.pdfjsLib) {
          const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(it => it.str).join(' ');
            pages.push(pageText);
            fullText += '\n' + pageText;
          }
        } else {
          // Fallback dacă pdfjsLib nu este expus global
          fullText = file.name;
        }

        rawDocs.push({
          name: file.name,
          text: fullText,
          pages
        });
      } catch (err) {
        console.error(`Eroare la citirea fișierului ${file.name}:`, err);
      }
    }

    if (rawDocs.length > 0) {
      const auditResult = await CalculAutoRentInspector.instance.inspectDosar(rawDocs);
      openModal(auditResult);
    }
  }

  // Interceptare evenimente Drag & Drop și Input File
  window.addEventListener('DOMContentLoaded', () => {
    // Interceptare input file PDF
    document.addEventListener('change', (e) => {
      if (e.target && e.target.type === 'file' && e.target.files) {
        processFilesWithInspector(Array.from(e.target.files));
      }
    }, true);

    // Interceptare Drop pe pagină
    window.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFilesWithInspector(Array.from(e.dataTransfer.files));
      }
    }, true);
  });

  // Expunere funcție globală de testare/apel manual
  window.triggerInspectorAudit = processFilesWithInspector;

})();
