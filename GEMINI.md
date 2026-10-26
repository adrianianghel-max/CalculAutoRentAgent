# CalculAutoRentAgent - Instrucțiuni și Context Asistent AI

Acest proiect reprezintă repository-ul de distribuție publică pentru **CalculAutoRent** (găzduit pe GitHub Pages la `https://adrianianghel-max.github.io/CalculAutoRentAgent/`).

Pentru specificațiile detaliate, logica de calcul a lipsei de folosință (Norma ASF, HG 298, ore manoperă : 4), auditul devizelor Audatex/Eurotax/DAT, verificările ANAF/CAEN 7711 și arhitectura de securitate cu criptare client-side, consultă fișierul complet de context:
👉 [CONTEXT.md](file:///C:/Users/adria/.gemini/antigravity-ide/scratch/CalculAutoRentAgent/CONTEXT.md)

### Reguli Esențiale ale Proiectului:
1. **Privacy-First & Zero Data Leak**: Documentele procesate (devize, facturi, dosare RCA) nu trebuie niciodată transmise către servere externe sau stocate în cloud. Toată procesarea PDF/OCR se realizează 100% în browser (local în memorie).
2. **Criptare Bundle (`main.js.enc`)**: Aplicația de producție este distribuită criptat (AES-GCM 256, PBKDF2 600.000 iterații) și deblocată cu parolă locală prin `auth.js`.
3. **Structura**:
   - `index.html`: Pagina de prezentare cu link către aplicație.
   - `app/`: Aplicația compilată deblocabilă cu parolă.
   - `app/caen7711.json`: Baza de date a firmelor autorizate pentru închiriere auto.
   - `app/fisa_template.xlsm`: Macheta oficială Excel pentru instrumentarea dosarelor cu abuz.
   - `app/tessdata/` și `app/tesseract/`: Resurse OCR locale în limba română.
