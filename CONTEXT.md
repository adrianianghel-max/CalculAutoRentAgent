# Contextul Aplicației: CalculAutoRent (CalculAutoRentAgent)

Document de arhitectură, specificații funcționale, cadru legal și ghid tehnic complet pentru dezvoltarea și utilizarea aplicației **CalculAutoRent**.

---

## 1. Prezentare Generală (Executive Summary)

**CalculAutoRent** este o aplicație web specializată pentru inspectorii de daune auto și lichidatorii de daune RCA din România (concepută inițial pentru procesul de instrumentare daune, ex. Groupama Asigurări).

### Obiective Principale
1. **Calculul legal și tehnologic al lipsei de folosință (Rent-a-Car / Mașină la schimb)** solicitate de păgubiți sau firmele de rent în baza polițelor RCA.
2. **Auditarea și corectarea devizelor de reparație auto** emise prin sistemele internaționale de calculație (**Audatex**, **Eurotax**, **DAT**).
3. **Detecția și prevenirea abuzurilor financiare** (tarife umflate la închiriere auto, tarife orare de manoperă peste tariful de referință, prelungiri nejustificate ale perioadei de reparație).
4. **Verificarea fiscală și de conformitate a emitenților** de facturi (autorizare CAEN 7711, stare activă/inactivă la ANAF, societăți radiate).
5. **Automatizarea documentației de aprobare și plată**: generarea referatului „Solicitare Acord Plată”, actualizarea automată a machetei Excel de daune (`Fisa dosarului RCA cazuri abuz-DOSAR Updatata.xlsm`), export PDF cu adnotări și generarea fișierului de email `.eml` pentru Outlook.

---

## 2. Cadrul Legal și Reglementări (RCA România)

Aplicația implementează cu strictețe legislația națională privind asigurările auto obligatorii:

- **Legea nr. 132/2017** privind asigurarea obligatorie de răspundere civilă auto (RCA):
  - Prevederile referitoare la despăgubirea prejudiciilor cauzate de lipsa de folosință a vehiculului avariat (art. 14, art. 19).
- **Norma ASF nr. 20/2017** (cu modificările și completările ulterioare):
  - Reglementarea metodologiei de calcul a perioadei de reparație și a numărului de zile de închiriere acordate.
  - Principiul acordării vehiculului de înlocuire exclusiv pe durata reparației tehnologice efective sau în perioada de la avizare la prima constatare în cazul vehiculelor nedeplasabile.
- **HG nr. 298**:
  - Termenul legal de inițiere a închirierii: dacă rentul începe la mai mult de **30 de zile de la avizare**, dreptul la despăgubire pentru rent devine nul (0 zile acordate).
- **Tarifele de Referință ASF (Anexa 1)**:
  - Nivelurile de referință pentru tarifele orare de manoperă (pe județe, tipuri de service – reprezentanță vs. independent – și mărci auto).

---

## 3. Logica de Business și Algoritmi de Calcul

### 3.1. Calculul Zilelor de Rent din Manoperă (Durata Tehnologică)
Formula fundamentală de calcul a zilelor tehnologice acceptate:
$$\text{Zile Reparație Tehnologică} = \left\lceil \frac{\text{Ore Manoperă Tinichigerie} + \text{Ore Manoperă Vopsitorie}}{4} \right\rceil$$

- Baza de calcul este de **4 ore de lucru pe zi** (conform normativelor standard din industria asigurărilor).
- Se rotunjește întotdeauna superior la număr întreg (`Math.ceil`).

### 3.2. Cronologia Daunei și Determinarea Zilelor Eligibile
Zilele de închiriere se determină prin analiza calendaristică a intersecției intervalelor:
1. **Perioada de Avizare - Constatare**:
   - Dacă autovehiculul este marcat ca **nedeplasabil**, zilele dintre Data Avizării și Data Primului Act de Constatare sunt eligibile pentru rent.
2. **Perioada de Reparație efectivă**:
   - Intervalul cuprins între `rep_start` și `rep_end`.
3. **Perioada de Închiriere facturată**:
   - Intervalul cuprins între `rent_start` și `rent_end`.
4. **Intersecția utilă**:
   - Rentul este eligibil exclusiv în intervalul comun: $\max(\text{rent\_start}, \text{rep\_start}) \le \text{zi} \le \min(\text{rent\_end}, \text{rep\_end})$.
5. **Weekend-uri și Zile Libere**:
   - Zilele de weekend (sâmbătă, duminică) și sărbătorile legale sunt contorizate în limita timpului tehnologic de lucru.
6. **Perioade de Culpă / Excludere (Suspendare)**:
   - Perioade introduse manual sau detectate (ex: așteptare accept comision fraudă, reconstatare, întârziere comandă piese neimputabilă asigurătorului). Aceste zile se marchează distinct și se exclud din despăgubirea asigurătorului.
7. **Plafonare**:
   - Zilele finale calculate nu pot depăși niciodată numărul de zile facturate de firma de rent (`zile_facturate`).

### 3.3. Algoritmul de Verificare a Abuzului de Tarif la Închiriere
Pentru a combate facturarea unor tarife speculative:
1. Se compară **Tariful Facturat pe zi** ($P_{\text{facturat}}$) cu **Tariful din Oferta de Piață de Referință** ($P_{\text{ofertă}}$ - ex. Rentalcars, platforme rent-a-car concurențiale):
$$\text{Ofertă Majorată} = P_{\text{ofertă}} \times 1.20 \quad (+20\% \text{ marjă de toleranță})$$
2. **Decizia**:
   - Dacă $\text{Ofertă Majorată} < P_{\text{facturat}}$:
     - Dosarul este încadrat la **ABUZ ÎNCHIRIERE**.
     - Despăgubirea aprobată se plafonează la prețul ofertei de referință:
       $$\text{Sumă Rent} = \text{Zile Acceptate} \times P_{\text{ofertă}}$$
   - Dacă $\text{Ofertă Majorată} \ge P_{\text{facturat}}$:
     - Tariful este considerat rezonabil și se acceptă tariful facturat:
       $$\text{Sumă Rent} = \text{Zile Acceptate} \times P_{\text{facturat}}$$

### 3.4. Echivalența Claselor Auto
- Se verifică compatibilitatea dintre:
  - **Clasa vehiculului avariat** (ex: Clasa B - Subcompactă, Clasa C - Compactă, Clasa D, SUV mediu etc.).
  - **Clasa vehiculului închiriat**.
- Conform normelor, păgubitul are dreptul la o clasă similară sau inferioară. Închirierea unei clase superioare nemotivate atrage recalibrarea tarifului la clasa autoturismului avariat.

### 3.5. Auditul și Corectarea Devizelor de Reparație
1. **Extragerea Datelor din Devize PDF** (Audatex, Eurotax, DAT):
   - Detecție automată: ore manoperă (mecanică, tinichigerie, vopsitorie), cost materiale vopsitorie, cost piese de schimb.
2. **Audit Tarif Orar Manoperă**:
   - Se compară tariful orar din deviz cu **Tariful de Referință** (Anexa 1 ASF).
   - În caz de tarif abuziv, se recalculează totalul devizului folosind tariful de referință.
3. **Deduceri & Corecții Suplimentare**:
   - Scăderi justificate din piese neomologate, operațiuni neconforme sau materiale supradimensionate.
4. **Adnotare PDF**:
   - Inserare automată pe deviz a mențiunii: *„Manopera de referință [X] lei/h lângă BAZA MANOPERA din calculația finală”* cu evidențiere vizuală colorată.

---

## 4. Verificări Fiscale și Antifraudă (ANAF & CAEN 7711)

Aplicația oferă protecție integrată împotriva fraudelor din domeniul închirierilor auto:

1. **Baza de Date Locală CAEN 7711 (`caen7711.json` - ~2.5 MB)**:
   - Conține lista societăților din România care au înregistrat și autorizat codul **CAEN 7711** (*„Activități de închiriere și leasing cu autoturisme și autovehicule rutiere ușoare”*).
   - Verifică instantaneu, local în browser, dacă CUI-ul firmei de rent deține această autorizare.
2. **Integrare ANAF în Timp Real (Cloudflare Worker)**:
   - Endpoint: `https://calcul-rent-anaf.adrianianghel.workers.dev`
   - Interoghează starea fiscală a emitentului:
     - Dacă firma este **activă fiscal** sau declarată **inactivă**.
     - Dacă firma este **radiată** din Registrul Comerțului.
     - Detaliile TVA (TVA la încasare, plătitor de TVA).
3. **Avertismente Antifraudă Automate**:
   - Alertă imediată dacă firma de rent sau unitatea reparatoare este inactivă sau radiată.
   - Alertă dacă emitentul facturii de rent nu are codul CAEN 7711 autorizat.

---

## 5. Documente Generate și Automatizări

### 5.1. Solicitare Acord Plată (Text Standardizat & PDF)
Generează automat referatul intern de aprobare adresat conducerii/lichidatorilor:
- Identificator dosar de daună, păgubit, număr înmatriculare, date de contact.
- Suma aprobată pentru reparație (cu scăderea avansului plătit anterior, dacă este cazul).
- Suma aprobată pentru închiriere, defalcată pas cu pas (avizare, constatare, ore manoperă, zile tehnologice, weekend-uri).
- Încadrarea propunerii: conformitate vs. abuz închiriere (cu argumentarea diferenței de tarif).
- Export ca document oficial `Solicitare_[nr_dosar].pdf`.

### 5.2. Actualizarea Machetei Excel a Dosarului (`fisa_template.xlsm`)
- Se integrează cu macheta oficială: `Fisa dosarului RCA cazuri abuz-DOSAR Updatata.xlsm`.
- Folosind tehnologia **File System Access API** a browserului și manipulare directă a structurii ZIP/XML din arhiva Office Open XML (`sheet1.xml`), aplicația populează automat celulele din fișierul Excel de pe desktopul inspectorului fără a necesita instalarea Microsoft Office pe server.

### 5.3. Generare Mesaj Outlook (`.eml`)
- Generează și descarcă fișierul `Solicitare acord plata [nr_dosar].eml`.
- La deschidere, se lansează direct în Microsoft Outlook cu:
  - Destinatari prestabiliți (lichidatori/șefi serviciu daune).
  - Subiect conform procedurilor interne.
  - Textul argumentat complet și semnătura profesională a inspectorului configurată din setări.

---

## 6. Arhitectură Software și Stack Tehnic

### 6.1. Tehnologii Cheie
- **Interfață Utilizator**: React (Single Page Application).
- **Stilizare**: Tailwind CSS, componente UI accesibile (Radix UI / shadcn architecture), Lucide Icons, suport Dark/Light theme.
- **Procesare PDF & Documente**:
  - `pdfjs-dist`: Parsare documente PDF, extragere text și coordonate geometrice ale liniilor/casete.
  - `tesseract.js`: Motor OCR rulat în Web Workers pentru devize scanate, cu model de limbă română (`ron.traineddata` din `tessdata`).
  - `jspdf`: Generare dinamică de rapoarte PDF vectoriale.
- **Manipulare Excel**: Modificare la nivel de celulă în pachete `.xlsm` (macro-enabled) folosind unelte de compresie zip și serializare XML.

### 6.2. Motorul de Învățare Adaptivă (Active Learning Memory)
- Fișier de memorie: `CalculAutoRent memorie invatare.json`.
- Categorii de reguli reținute:
  1. `rca_pdf_layout_rules_v1`: Reguli de layout vizual (ancore, semnături).
  2. `rca_pdf_context_rules_v1`: Reguli de context semantic (cuvinte-cheie din proximitate).
  3. `rca_repair_audit_rules_v1`: Reguli de audit deviz și corecții manoperă/materiale.
- Oferă inspectorului posibilitatea de a salva și încărca memoria de învățare pentru a păstra acuratețea modelului pe calculatoare diferite.

---

## 7. Model de Securitate, Criptare și Pipeline de Deployment

Aplicația operează sub standarde stricte de securitate și confidențialitate a datelor (**GDPR & Secret profesional**):

### 7.1. Arhitectură 100% Client-Side (Zero Data Leak)
- Niciun document încărcat (devize, facturi, acte de identitate, note de constatare) **nu părăsește browserul utilizatorului**.
- Toate calculele, analizele OCR și procesările PDF se execută exclusiv în memoria locală (RAM) a dispozitivului.

### 7.2. Criptarea Bundle-ului la Repaus (Client-Side Decryption)
Pentru a permite găzduirea pe GitHub Pages fără a expune codul sursă proprietar:
1. Codul aplicației este distribuit criptat: `main.[hash].js.enc`.
2. Mecanism de derivare a cheii: **PBKDF2-SHA256** cu **600.000 iterații** și salt criptografic (`auth-config.json`).
3. Criptografie simetrică: **AES-GCM (256 biți)** prin Web Crypto API nativ al browserului.
4. Încărcătorul de autentificare (`auth.js`):
   - Solicită parola inspectorului la fiecare accesare.
   - Decriptează pachetul în memorie ca `Blob` securizat și îl atașează dinamic în pagină.
   - Șterge imediat cheile și parola din memorie la blocare sau reîmprospătare a ferestrei.

### 7.3. Fluxul de Deployment (CI/CD)
- **Repository privat de dezvoltare**: `CalculAutoRent` (conține codul sursă React, componentele și testele).
- **GitHub Actions Pipeline**:
  - Rulează build-ul de producție.
  - Criptează artefactul JS cu parola prestabilită.
  - Publică pachetul criptat în repo-ul public: `https://github.com/adrianianghel-max/CalculAutoRentAgent`.
- **Găzduire**: GitHub Pages la `https://adrianianghel-max.github.io/CalculAutoRentAgent/`.

---

## 8. Dicționarul Câmpurilor de Date

| Nume Câmp | Tip | Descriere |
|---|---|---|
| `nr_dosar` | String | Numărul dosarului de daună RCA |
| `marca_model` | String | Marca și modelul autovehiculului avariat |
| `data_avizare` | Date | Data la care a fost avizat dosarul de daună la asigurător |
| `data_constatare` | Date | Data întocmirii procesului-verbal de constatare |
| `data_inmatriculare`| Date | Data primei înmatriculări a autovehiculului avariat |
| `auto_inchiriat_marca` | String | Marca și modelul autoturismului închiriat |
| `auto_inchiriat_clasa` | String | Clasa autoturismului închiriat (A, B, C, D, SUV etc.) |
| `auto_oferta_marca` | String | Marca/modelul din oferta etalon de piață (RentalCars) |
| `rent_start` / `rent_end` | Date | Intervalul perioadei de închiriere facturate |
| `rep_start` / `rep_end` | Date | Intervalul perioadei în care vehiculul a fost în service |
| `zile_facturate` | Number | Numărul total de zile facturate de firma de rent |
| `pret_facturat` | Number | Tariful orar/zilnic facturat de firma de rent |
| `pret_oferta` | Number | Tariful zilnic din oferta etalon (RentalCars) |
| `ora_manopera_facturata` | Number | Tariful orar de manoperă facturat de service |
| `ora_manopera_referinta` | Number | Tariful de manoperă de referință (Anexa 1 ASF) |
| `valoare_desp_rep_facturata` | Number | Valoarea totală a devizului de reparație facturat |
| `valoare_desp_rep_acceptata` | Number | Valoarea acceptată la plată a devizului de reparație |
| `avans_reparatie` | Number | Valoarea avansului deja achitat către service |
| `zile_rent_calculat` | Number | Zilele de rent rezultate din algoritmul tehnologic |
| `zile_rent_acceptate` | Number | Zilele finale de rent propuse spre despăgubire |
| `suma_rent` | Number | Valoarea totală a despăgubirii pentru închiriere |
| `rent_cui` / `rep_cui` | String | Codul de identificare fiscală pentru firma de rent / service |
| `rent_emitent` / `rep_emitent` | String | Denumirea comercială a emitentului facturilor |
| `culpa_periods` | Array | Intervale temporale de întrerupere/culpă deduse |
| `holidays` | Array | Listă de sărbători legale luate în calcul |
