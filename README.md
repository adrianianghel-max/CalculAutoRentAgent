# CalculAutoRentAgent

Pagină publică de pornire și deployment pentru aplicația **CalculAutoRent**.

- **Pagina de prezentare**: [https://adrianianghel-max.github.io/CalculAutoRentAgent/](https://adrianianghel-max.github.io/CalculAutoRentAgent/)
- **Aplicația live**: [https://adrianianghel-max.github.io/CalculAutoRentAgent/app/](https://adrianianghel-max.github.io/CalculAutoRentAgent/app/) — acces securizat cu parolă verificată local în browser.

---

## 🔍 Subagent Inteligent: Inspector Daune Auto RCA & Adaptive Skills

Aplicația include un motor avansat de **subagenți inteligenți și abilități adaptive (Skills)** care procesează dosarele de daună auto și analizează PDF-urile încărcate exact cum gândește un inspector de daune senior:

### 1. Clasificare și Recunoaștere Documentară
- **Notă de Constatare (NC)** / Proces-Verbal de Constatare Daune
- **Poliță RCA / Info Poliță** (`cst_nl_info_polita...`)
- **Factură de Reparație** emisă de unitatea reparatoare
- **Deviz Detaliat de Reparație** (Audatex, Eurotax, DAT)
- **Factură de Închiriere Auto (Rent)** și Proces-Verbal predare-primire
- **Cerere de Despăgubire** a persoanei păgubite
- **Contract de Cesiune de Creanță** / Notificare de cesiune
- **Certificat de Înmatriculare (Talon) & CI**

### 2. Audit de Conformitate Juridică și Administrativă
- **Verificare Beneficiar Facturi**: Factura de reparație și factura de rent sunt verificate dacă sunt emise obligatoriu pe numele **părții păgubite**. Dacă beneficiarul este un terț și nu există contract de cesiune, subagentul semnalează o neconformitate critică!
- **Verificare Cerere de Despăgubire**: Verifică existența semnăturii olografe a păgubitului și aplicarea obligatorie a **ștampilei** dacă păgubitul este Persoană Juridică (PJ - SRL, SA).
- **Rezolvare Cesiune de Creanță**: Detectează existența contractului de cesiune (către service sau rent) și extrage automat datele cesionarului (Denumire, CUI/CIF, IBAN, Bancă, Reprezentant) mapându-le direct în formular la **rubrica Cesionarului**.

### 3. Memorie de Învățare Continuă (Adaptive Skills Store)
- Subagentul reține formate noi de facturi și clauze atipice prin sistemul integrat de învățare (`damage-inspector-skills.json` / localStorage).
- Inspectorul poate corecta sau confirma noi tipare printr-un simplu clic, iar abilitățile agentului devin mai performante cu fiecare dosar lucrat.
- Suportă funcționalitate de **Export & Import Skills** pentru partajarea cunoștințelor între colegi.

### 4. Panou de Audit și Sumar Dosar (Dosar Audit Summary)
- Generează un ecran complet de audit înainte de popularea formularului:
  - **Semafor de conformitate**: Verde (Conform), Galben (Avertismente), Roșu (Neconformități critice).
  - Checklist cu toate documentele identificate.
  - Carduri sintetice: Păgubit, Cesiune, Reparație, Închiriere.
  - Buton „Aplică Datele în Formular” pentru populare dintr-un singur pas.

---

## 🔒 Confidențialitate și Securitate (GDPR)
- **100% Client-Side**: Niciun document încărcat (devize, facturi, date cu caracter personal) nu părăsește browserul utilizatorului. Toate procesările PDF/OCR și analizele au loc local, în memoria RAM.
- **Criptare Bundle**: Codul aplicației de producție este stocat criptat (`main.js.enc`) cu **AES-GCM (256 biți)** și **PBKDF2-SHA256 (600.000 iterații)**.
