/**
 * CalculAutoRent - Damage Claim Inspector Subagent & Adaptive Skills Engine
 * 
 * Sistem autonom de subagenți inteligenți care:
 * 1. Clasifică și recunoaște documentele dintr-un dosar de daună RCA (NC, Poliță, Facturi, Devize, Cerere Despăgubire, Cesiune).
 * 2. Identifică partea păgubită (proprietar/utilizator, persoană fizică sau juridică).
 * 3. Auditează conformitatea documentelor (beneficiar facturi == păgubit, cerere semnată/ștampilată de păgubit).
 * 4. Rezolvă contractele de cesiune de creanță și mapează datele cesionarului în formular.
 * 5. Extrage cu precizie datele tehnice și financiare din facturi și devize.
 * 6. Învață continuu (Adaptive Learning Skills) pe măsură ce inspectorul lucrează cu aplicația.
 */

(function (global) {
  'use strict';

  // --- 1. Helper-e de normalizare text și date ---
  const normalizeText = (text) => {
    if (!text) return '';
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  };

  const cleanAlphanum = (text) => {
    return normalizeText(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  const parseRomanianDate = (str) => {
    if (!str) return null;
    const match = String(str).match(/(\b\d{1,2})[./\-](\d{1,2})[./\-](\d{4}\b)/);
    if (!match) return null;
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${d}.${m}.${y}`;
  };

  const parseMoney = (str) => {
    if (!str) return null;
    const cleaned = String(str).replace(/\s/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : Math.round(val * 100) / 100;
  };

  // Verifică dacă o entitate este persoană juridică (PJ)
  const isCompany = (name) => {
    if (!name) return false;
    const n = normalizeText(name).toUpperCase();
    return /\b(SRL|S\.R\.L\.|SA|S\.A\.|SNC|SCS|PFA|P\.F\.A\.|I\.I\.|II|I\.F\.|IF|SOCIETATEA|SC|S\.C\.)\b/.test(n);
  };

  // Compară similitudinea numelor (ignoring titluri, forma juridică, spații)
  const namesMatch = (name1, name2) => {
    if (!name1 || !name2) return false;
    const n1 = cleanAlphanum(name1).replace(/(SRL|SA|PFA|SC|SOCIETATEA)/g, '');
    const n2 = cleanAlphanum(name2).replace(/(SRL|SA|PFA|SC|SOCIETATEA)/g, '');
    if (!n1 || !n2) return false;
    return n1.includes(n2) || n2.includes(n1) || (n1.length > 5 && n2.length > 5 && (n1.slice(0, 8) === n2.slice(0, 8)));
  };

  // --- 2. Baza de Cunoștințe & Memorie de Învățare (Continuous Learning Store) ---
  const DEFAULT_SKILLS = {
    version: '2.0.0',
    updatedAt: new Date().toISOString(),
    documentTypes: [
      {
        id: 'NC',
        label: 'Notă de Constatare (NC)',
        anchors: [
          'PROCES-VERBAL DE CONSTATARE',
          'PROCES VERBAL DE CONSTATARE',
          'NOTA DE CONSTATARE',
          'DOCUMENT DE INTRARE IN REPARATIE',
          'CONSTATAT LA DATA',
          'AVARIAT LA DATA',
          'PAGUBIT'
        ],
        negativeAnchors: ['FACTURA', 'DEVIZ ESTIMATIV', 'CONTRACT DE INCHIRIERE']
      },
      {
        id: 'POLITA',
        label: 'Poliță RCA / Info Poliță',
        anchors: [
          'INFORMATII POLITE',
          'INFORMATII POLITA',
          'POLITA DE ASIGURARE',
          'POLICY STATE',
          'INSR BEGIN',
          'ASIGURARE OBLIGATORIE',
          'CLASA B/M',
          'CLASA BM'
        ],
        negativeAnchors: ['PROCES-VERBAL', 'FACTURA FISCALA']
      },
      {
        id: 'FACTURA_REP',
        label: 'Factură Reparație Service',
        anchors: [
          'FACTURA',
          'MANOPERA',
          'TINICHIGERIE',
          'VOPSITORIE',
          'PIESE DE SCHIMB',
          'REPARATIE AUTO',
          'TOTAL DE PLATA',
          'CLIENT',
          'CUMPARATOR'
        ],
        negativeAnchors: ['INCHIRIERE AUTO', 'RENT A CAR', 'LIPSA DE FOLOSINTA']
      },
      {
        id: 'DEVIZ_REP',
        label: 'Deviz / Calculație Reparație',
        anchors: [
          'CALCULATIE REPARATIE',
          'CALCULATIA DE REPARATIE',
          'SISTEM AUDATEX',
          'AUDATEX',
          'EUROTAX',
          'DAT GMBH',
          'BAZA MANOPERA',
          'TIMPI DE LUCRU',
          'OPERATII MECANICA'
        ],
        negativeAnchors: ['FACTURA FISCALA', 'CONTRACT DE INCHIRIERE']
      },
      {
        id: 'FACTURA_RENT',
        label: 'Factură Închiriere Auto (Rent)',
        anchors: [
          'FACTURA',
          'INCHIRIERE AUTO',
          'INCHIRIERE AUTOTURISM',
          'RENT A CAR',
          'LIPSA DE FOLOSINTA',
          'VEHICUL DE INLOCUIRE',
          'TARIF ZI',
          'ZILE INCHIRIERE'
        ],
        negativeAnchors: ['PIESE DE SCHIMB', 'VOPSITORIE', 'TINICHIGERIE']
      },
      {
        id: 'CONTRACT_RENT',
        label: 'Contract Închiriere / PV Predare-Primire',
        anchors: [
          'CONTRACT DE INCHIRIERE',
          'CONTRACT DE LOCATIUNE',
          'PROCES-VERBAL DE PREDARE-PRIMIRE',
          'PROCES VERBAL DE PREDARE PRIMIRE',
          'PERIOADA INCHIRIERII',
          'KM LA PLECARE',
          'KM LA RETUR',
          'LOCATOR',
          'LOCATAR'
        ],
        negativeAnchors: ['DEVIZ', 'CALCULATIE']
      },
      {
        id: 'CERERE_DESPAGUBIRE',
        label: 'Cerere de Despăgubire',
        anchors: [
          'CERERE DE DESPAGUBIRE',
          'CERERE PENTRU DESPAGUBIRE',
          'AVIZARE DAUNA',
          'SOLICIT DESPAGUBIREA',
          'SUBSEMNATUL',
          'DECLAR PE PROPRIA RASPUNDERE',
          'SEMNATURA PAGUBIT',
          'SEMNATURA ASIGURAT',
          'SEMNATURA SOLICITANT'
        ],
        negativeAnchors: ['FACTURA', 'CALCULATIE']
      },
      {
        id: 'CONTRACT_CESIUNE',
        label: 'Contract de Cesiune de Creanță',
        anchors: [
          'CONTRACT DE CESIUNE',
          'CESIUNE DE CREANTA',
          'NOTIFICARE DE CESIUNE',
          'ACORD DE CESIUNE',
          'CEDENT',
          'CESIONAR',
          'CREANTA REZULTATA DIN DOSARUL',
          'DREPTURILE DE DESPAGUBIRE',
          'CONT IBAN CESIONAR'
        ],
        negativeAnchors: ['DEVIZ', 'POLITA']
      },
      {
        id: 'TALON_CI',
        label: 'Certificat Înmatriculare / Act Identitate',
        anchors: [
          'CERTIFICAT DE INMATRICULARE',
          'CARTE DE IDENTITATE',
          'NUMAR DE IDENTIFICARE',
          'PROPRIETAR',
          'UTILIZATOR'
        ],
        negativeAnchors: ['FACTURA', 'CERERE DE DESPAGUBIRE']
      }
    ],
    learnedPatterns: []
  };

  class LearningStore {
    constructor() {
      this.storageKey = 'calcul_rent_inspector_skills_v2';
      this.skills = this.load();
    }

    load() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.documentTypes) return parsed;
        }
      } catch (err) {
        console.warn('Nu s-a putut încărca memoria de învățare din localStorage:', err);
      }
      return JSON.parse(JSON.stringify(DEFAULT_SKILLS));
    }

    save() {
      try {
        this.skills.updatedAt = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(this.skills));
      } catch (err) {
        console.error('Eroare la salvarea abilităților:', err);
      }
    }

    recordLearnedPattern(docType, anchorPattern, fieldMapping) {
      this.skills.learnedPatterns.push({
        id: 'lp_' + Date.now(),
        docType,
        anchorPattern,
        fieldMapping,
        confidence: 1.0,
        createdAt: new Date().toISOString()
      });
      this.save();
    }

    exportJSON() {
      return JSON.stringify(this.skills, null, 2);
    }

    importJSON(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.documentTypes) {
          this.skills = parsed;
          this.save();
          return true;
        }
      } catch (err) {
        throw new Error('Format JSON de abilități invalid: ' + err.message);
      }
      return false;
    }

    resetToDefaults() {
      this.skills = JSON.parse(JSON.stringify(DEFAULT_SKILLS));
      this.save();
    }
  }

  // --- 3. Subagenți Specializați (Skills) ---

  // Subagent 1: Clasificator de Documente
  class DocumentClassifierSubagent {
    constructor(learningStore) {
      this.learningStore = learningStore;
    }

    classify(pageText, filename = '') {
      const normText = normalizeText(pageText).toUpperCase();
      const normFile = normalizeText(filename).toUpperCase();

      let bestType = 'UNKNOWN';
      let maxScore = 0;
      let matches = [];

      for (const doc of this.learningStore.skills.documentTypes) {
        let score = 0;
        let matchedAnchors = [];

        for (const anchor of doc.anchors) {
          if (normText.includes(anchor)) {
            score += 2;
            matchedAnchors.push(anchor);
          }
        }

        // Boost dacă numele fișierului conține indicii
        if (normFile.includes(doc.id) || (doc.id === 'NC' && normFile.includes('NC')) ||
            (doc.id === 'POLITA' && (normFile.includes('POLIT') || normFile.includes('CST_NL'))) ||
            (doc.id === 'CERERE_DESPAGUBIRE' && normFile.includes('CERERE')) ||
            (doc.id === 'CONTRACT_CESIUNE' && normFile.includes('CESIUN'))) {
          score += 3;
        }

        // Penalizare pentru negative anchors
        if (doc.negativeAnchors) {
          for (const neg of doc.negativeAnchors) {
            if (normText.includes(neg)) score -= 2;
          }
        }

        if (score > maxScore && score >= 2) {
          maxScore = score;
          bestType = doc.id;
          matches = matchedAnchors;
        }
      }

      return {
        type: bestType,
        score: maxScore,
        matchedAnchors: matches,
        filename
      };
    }
  }

  // Subagent 2: Identificator Parte Păgubită
  class DamagedPartyAuditorSubagent {
    audit(documents) {
      const ncDocs = documents.filter(d => d.classification.type === 'NC');
      const talonDocs = documents.filter(d => d.classification.type === 'TALON_CI');
      const cerereDocs = documents.filter(d => d.classification.type === 'CERERE_DESPAGUBIRE');

      let numePagubit = '';
      let cuiCnpPagubit = '';
      let autoMarcaModel = '';
      let nrInmatriculare = '';
      let serieSasiu = '';

      // Extracție din NC
      for (const doc of ncDocs) {
        const text = doc.text;
        const norm = normalizeText(text);

        // Nume Păgubit
        const pagubitMatch = norm.match(/(?:pagubit|proprietar|utilizator|asigurat|solicitant)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
        if (pagubitMatch && !numePagubit) {
          numePagubit = pagubitMatch[1].trim();
        }

        // Număr Înmatriculare
        const nrInmatrMatch = norm.match(/(?:nr\.?\s*inmatriculare|nr\.?\s*auto|numar\s*inmatriculare)\s*[:\-]?\s*([A-Z0-9\- ]{5,15})/i);
        if (nrInmatrMatch && !nrInmatriculare) {
          nrInmatriculare = nrInmatrMatch[1].trim().toUpperCase();
        }

        // Serie Șasiu (VIN)
        const vinMatch = norm.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
        if (vinMatch && !serieSasiu) {
          serieSasiu = vinMatch[1].toUpperCase();
        }

        // Marcă / Model
        const autoMatch = norm.match(/(?:marca\s*(?:si|\/)?\s*model|autovehicul|auto)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,40})/i);
        if (autoMatch && !autoMarcaModel) {
          autoMarcaModel = autoMatch[1].trim();
        }
      }

      // Extracție din Cererea de despăgubire dacă NC e lacunară
      if (!numePagubit) {
        for (const doc of cerereDocs) {
          const norm = normalizeText(doc.text);
          const subsemnatulMatch = norm.match(/(?:subsemnatul(?:\(a\))?|societatea|sc)\s+([A-Z0-9\.\- ]{3,60})/i);
          if (subsemnatulMatch) {
            numePagubit = subsemnatulMatch[1].trim();
            break;
          }
        }
      }

      const isPJ = isCompany(numePagubit);

      return {
        nume_pagubit: numePagubit,
        cui_cnp: cuiCnpPagubit,
        is_pj: isPJ,
        marca_model: autoMarcaModel,
        numar_inmatriculare: nrInmatriculare,
        serie_sasiu: serieSasiu,
        verified: !!numePagubit
      };
    }
  }

  // Subagent 3: Auditor de Conformitate & Semnături/Ștampile
  class DocumentConformitySubagent {
    audit(damagedParty, documents, cession) {
      const issues = [];
      const passed = [];

      // 1. Verificare Factură Reparație
      const repInvoices = documents.filter(d => d.classification.type === 'FACTURA_REP');
      if (repInvoices.length > 0) {
        let repBeneficiarFound = false;
        let repBeneficiarName = '';

        for (const inv of repInvoices) {
          const norm = normalizeText(inv.text);
          const benMatch = norm.match(/(?:cumparator|client|beneficiar)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
          if (benMatch) {
            repBeneficiarName = benMatch[1].trim();
            if (damagedParty.nume_pagubit && namesMatch(repBeneficiarName, damagedParty.nume_pagubit)) {
              repBeneficiarFound = true;
            }
          }
        }

        if (repBeneficiarFound) {
          passed.push({
            rule: 'BENEFICIAR_FACTURA_REP',
            title: 'Factură Reparație conformă',
            description: `Factura de reparație este emisă pe numele părții păgubite (${damagedParty.nume_pagubit}).`
          });
        } else if (repBeneficiarName) {
          if (cession.has_cession) {
            passed.push({
              rule: 'BENEFICIAR_FACTURA_REP_CESIONAT',
              title: 'Factură Reparație acoperită de cesiune',
              description: `Factura este emisă pe ${repBeneficiarName}, dar există contract de cesiune în dosar către cesionar.`
            });
          } else {
            issues.push({
              severity: 'CRITICAL',
              rule: 'BENEFICIAR_FACTURA_REP_MISMATCH',
              title: 'Neconcordanță beneficiar factură reparație!',
              description: `Factura de reparație este emisă către „${repBeneficiarName}”, diferit de partea păgubită („${damagedParty.nume_pagubit || 'Nedeterminată'}”), și nu s-a identificat un contract de cesiune.`
            });
          }
        }
      }

      // 2. Verificare Factură Rent
      const rentInvoices = documents.filter(d => d.classification.type === 'FACTURA_RENT');
      if (rentInvoices.length > 0) {
        let rentBeneficiarFound = false;
        let rentBeneficiarName = '';

        for (const inv of rentInvoices) {
          const norm = normalizeText(inv.text);
          const benMatch = norm.match(/(?:cumparator|client|beneficiar)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
          if (benMatch) {
            rentBeneficiarName = benMatch[1].trim();
            if (damagedParty.nume_pagubit && namesMatch(rentBeneficiarName, damagedParty.nume_pagubit)) {
              rentBeneficiarFound = true;
            }
          }
        }

        if (rentBeneficiarFound) {
          passed.push({
            rule: 'BENEFICIAR_FACTURA_RENT',
            title: 'Factură Rent conformă',
            description: `Factura de închiriere este emisă pe numele părții păgubite (${damagedParty.nume_pagubit}).`
          });
        } else if (rentBeneficiarName) {
          if (cession.has_cession) {
            passed.push({
              rule: 'BENEFICIAR_FACTURA_RENT_CESIONAT',
              title: 'Factură Rent acoperită de cesiune',
              description: `Factura de rent este emisă pe ${rentBeneficiarName}, acoperită de cesiunea de creanță identificată.`
            });
          } else {
            issues.push({
              severity: 'CRITICAL',
              rule: 'BENEFICIAR_FACTURA_RENT_MISMATCH',
              title: 'Neconcordanță beneficiar factură rent!',
              description: `Factura de rent este emisă către „${rentBeneficiarName}”, diferit de partea păgubită („${damagedParty.nume_pagubit || 'Nedeterminată'}”), fără cesiune de creanță atașată.`
            });
          }
        }
      }

      // 3. Verificare Cerere de Despăgubire
      const cerereDocs = documents.filter(d => d.classification.type === 'CERERE_DESPAGUBIRE');
      if (cerereDocs.length === 0) {
        issues.push({
          severity: 'WARNING',
          rule: 'CERERE_DESPAGUBIRE_LIPSA',
          title: 'Cererea de despăgubire nu a fost găsită!',
          description: 'În pachetul de documente încărcat nu a fost identificată o Cerere de Despăgubire tipizată.'
        });
      } else {
        const cerere = cerereDocs[0];
        const norm = normalizeText(cerere.text).toUpperCase();

        const hasSignatureMention = /SEMNATURA|SEMNAT|SEMNATURA ASIGURAT|SEMNATURA PAGUBIT/.test(norm);
        if (hasSignatureMention) {
          passed.push({
            rule: 'CERERE_SEMNATURA',
            title: 'Cerere de despăgubire conține secțiune de semnătură',
            description: 'Documentul include asumarea răspunderii și rubrica de semnătură a solicitantului.'
          });
        } else {
          issues.push({
            severity: 'WARNING',
            rule: 'CERERE_SEMNATURA_DUBIOASA',
            title: 'Verifică semnătura pe cererea de despăgubire',
            description: 'Nu s-a putut confirma cu certitudine rubrica de semnătură olografă a solicitantului.'
          });
        }

        if (damagedParty.is_pj) {
          const hasStampMention = /L\.S\.|LS|STAMPILA|STAMPILAT/.test(norm);
          if (hasStampMention) {
            passed.push({
              rule: 'CERERE_STAMPILA_PJ',
              title: 'Ștampilă Persoană Juridică prevăzută',
              description: 'Cererea conține mențiunea / rubrica de ștampilă a reprezentantului legal al societății păgubite.'
            });
          } else {
            issues.push({
              severity: 'WARNING',
              rule: 'CERERE_STAMPILA_LIPSA',
              title: 'Atenție: Păgubitul este Persoană Juridică!',
              description: 'Verifică dacă cererea de despăgubire are aplicată ștampila oficială a societății alături de semnătură.'
            });
          }
        }
      }

      const overallStatus = issues.some(i => i.severity === 'CRITICAL')
        ? 'CRITICAL'
        : issues.length > 0
        ? 'WARNING'
        : 'VALID';

      return {
        status: overallStatus,
        issues,
        passed
      };
    }
  }

  // Subagent 4: Rezolvator Contract de Cesiune de Creanță
  class CessionContractSubagent {
    audit(documents) {
      const cessionDocs = documents.filter(d => d.classification.type === 'CONTRACT_CESIUNE');
      if (cessionDocs.length === 0) {
        return {
          has_cession: false,
          cesionar: null
        };
      }

      let numeCesionar = '';
      let cuiCesionar = '';
      let ibanCesionar = '';
      let bancaCesionar = '';
      let adresaCesionar = '';
      let reprezentantCesionar = '';

      for (const doc of cessionDocs) {
        const text = doc.text;
        const norm = normalizeText(text);

        // Nume Cesionar
        const cesionarMatch = norm.match(/(?:cesionar(?:ul)?|catre)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
        if (cesionarMatch && !numeCesionar) {
          numeCesionar = cesionarMatch[1].trim();
        }

        // CUI Cesionar
        const cuiMatch = norm.match(/(?:cui|cif|cod fiscal|cod unic de inregistrare)\s*[:\-]?\s*(RO)?\s*([0-9]{6,10})/i);
        if (cuiMatch && !cuiCesionar) {
          cuiCesionar = (cuiMatch[1] || '') + cuiMatch[2];
        }

        // Cont IBAN Cesionar
        const ibanMatch = norm.match(/\b(RO[0-9]{2}[A-Z]{4}[0-9A-Z]{16})\b/i);
        if (ibanMatch && !ibanCesionar) {
          ibanCesionar = ibanMatch[1].toUpperCase();
        }

        // Banca
        const bancaMatch = norm.match(/(?:banca|deschis la)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,40})/i);
        if (bancaMatch && !bancaCesionar) {
          bancaCesionar = bancaMatch[1].trim();
        }

        // Sediul / Adresa
        const adresaMatch = norm.match(/(?:sediul in|sediu|adresa)\s*[:\-]?\s*([A-Z0-9\.\-, ]{5,80})/i);
        if (adresaMatch && !adresaCesionar) {
          adresaCesionar = adresaMatch[1].trim();
        }

        // Reprezentant legal
        const reprMatch = norm.match(/(?:reprezentat(?:a)? prin|administrator)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,40})/i);
        if (reprMatch && !reprezentantCesionar) {
          reprezentantCesionar = reprMatch[1].trim();
        }
      }

      return {
        has_cession: true,
        cesionar: {
          nume_cesionar: numeCesionar,
          cui_cesionar: cuiCesionar,
          cont_iban_cesionar: ibanCesionar,
          banca_cesionar: bancaCesionar,
          adresa_cesionar: adresaCesionar,
          reprezentant_cesionar: reprezentantCesionar
        }
      };
    }
  }

  // Subagent 5: Parser Detaliat Facturi & Devize
  class InvoicesAndEstimatesSubagent {
    audit(documents) {
      const data = {
        reparatie: {
          rep_factura_nr: '',
          rep_factura_data: '',
          rep_emitent: '',
          rep_cui: '',
          rep_total: null,
          valoare_desp_rep_facturata: null,
          rep_start: '',
          rep_end: '',
          ore_tinichigerie: 0,
          ore_vopsitorie: 0,
          ore_mecanica: 0,
          ora_manopera_facturata: null
        },
        rent: {
          rent_factura_nr: '',
          rent_factura_data: '',
          rent_emitent: '',
          rent_cui: '',
          rent_start: '',
          rent_end: '',
          zile_facturate: null,
          pret_facturat: null,
          auto_inchiriat_marca: '',
          valoare_desp_rent_facturata: null
        }
      };

      // Facturi Reparație
      const repInvoices = documents.filter(d => d.classification.type === 'FACTURA_REP');
      for (const doc of repInvoices) {
        const norm = normalizeText(doc.text);

        const nrMatch = norm.match(/(?:factura\s*(?:nr|numar|seria)?)\s*[:\-]?\s*([A-Z0-9\-_]+)/i);
        if (nrMatch && !data.reparatie.rep_factura_nr) data.reparatie.rep_factura_nr = nrMatch[1].trim();

        const dataMatch = norm.match(/(?:data\s*(?:emiterii|facturii)?)\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})/i);
        if (dataMatch && !data.reparatie.rep_factura_data) data.reparatie.rep_factura_data = parseRomanianDate(dataMatch[1]);

        const emitentMatch = norm.match(/(?:furnizor|emitent|prestator|societate)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
        if (emitentMatch && !data.reparatie.rep_emitent) data.reparatie.rep_emitent = emitentMatch[1].trim();

        const cuiMatch = norm.match(/(?:cui|cif|cod fiscal)\s*[:\-]?\s*(RO)?\s*([0-9]{6,10})/i);
        if (cuiMatch && !data.reparatie.rep_cui) data.reparatie.rep_cui = (cuiMatch[1] || '') + cuiMatch[2];

        const totalMatch = norm.match(/(?:total\s*(?:de plata|factura|general)?)\s*[:\-]?\s*([0-9\., ]+)\s*(?:lei|ron)/i);
        if (totalMatch && !data.reparatie.rep_total) {
          const val = parseMoney(totalMatch[1]);
          data.reparatie.rep_total = val;
          data.reparatie.valoare_desp_rep_facturata = val;
        }

        const manoperaTarifMatch = norm.match(/(?:tarif|pret)\s*(?:ora|orar|manopera)\s*[:\-]?\s*([0-9\.,]+)/i);
        if (manoperaTarifMatch && !data.reparatie.ora_manopera_facturata) {
          data.reparatie.ora_manopera_facturata = parseMoney(manoperaTarifMatch[1]);
        }
      }

      // Devize Reparație (Ore Manoperă)
      const devize = documents.filter(d => d.classification.type === 'DEVIZ_REP');
      for (const doc of devize) {
        const norm = normalizeText(doc.text);

        // Tinichigerie
        const tinMatch = norm.match(/(?:tinichigerie|caroserie|tin)\s*[:\-]?\s*([0-9\.,]+)\s*(?:h|ore|ora|ut)/i);
        if (tinMatch && !data.reparatie.ore_tinichigerie) {
          data.reparatie.ore_tinichigerie = parseFloat(tinMatch[1].replace(',', '.'));
        }

        // Vopsitorie
        const vopsMatch = norm.match(/(?:vopsitorie|vops)\s*[:\-]?\s*([0-9\.,]+)\s*(?:h|ore|ora|ut)/i);
        if (vopsMatch && !data.reparatie.ore_vopsitorie) {
          data.reparatie.ore_vopsitorie = parseFloat(vopsMatch[1].replace(',', '.'));
        }

        // Mecanică
        const mecMatch = norm.match(/(?:mecanica|mec)\s*[:\-]?\s*([0-9\.,]+)\s*(?:h|ore|ora|ut)/i);
        if (mecMatch && !data.reparatie.ore_mecanica) {
          data.reparatie.ore_mecanica = parseFloat(mecMatch[1].replace(',', '.'));
        }
      }

      // Facturi Rent
      const rentInvoices = documents.filter(d => d.classification.type === 'FACTURA_RENT');
      for (const doc of rentInvoices) {
        const norm = normalizeText(doc.text);

        const nrMatch = norm.match(/(?:factura\s*(?:nr|numar|seria)?)\s*[:\-]?\s*([A-Z0-9\-_]+)/i);
        if (nrMatch && !data.rent.rent_factura_nr) data.rent.rent_factura_nr = nrMatch[1].trim();

        const dataMatch = norm.match(/(?:data\s*(?:emiterii|facturii)?)\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})/i);
        if (dataMatch && !data.rent.rent_factura_data) data.rent.rent_factura_data = parseRomanianDate(dataMatch[1]);

        const emitentMatch = norm.match(/(?:furnizor|emitent|prestator|societate)\s*[:\-]?\s*([A-Z0-9\.\- ]{3,60})/i);
        if (emitentMatch && !data.rent.rent_emitent) data.rent.rent_emitent = emitentMatch[1].trim();

        const cuiMatch = norm.match(/(?:cui|cif|cod fiscal)\s*[:\-]?\s*(RO)?\s*([0-9]{6,10})/i);
        if (cuiMatch && !data.rent.rent_cui) data.rent.rent_cui = (cuiMatch[1] || '') + cuiMatch[2];

        // Perioadă Rent
        const periodMatch = norm.match(/(?:perioada|interval|din data de)?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})\s*(?:-|pana la|la)\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})/i);
        if (periodMatch && !data.rent.rent_start) {
          data.rent.rent_start = parseRomanianDate(periodMatch[1]);
          data.rent.rent_end = parseRomanianDate(periodMatch[2]);
        }

        // Zile Facturate
        const zileMatch = norm.match(/([0-9]+)\s*(?:zile|zi)\s*(?:inchiriere|rent)?/i);
        if (zileMatch && !data.rent.zile_facturate) {
          data.rent.zile_facturate = parseInt(zileMatch[1], 10);
        }

        // Tarif / Preț pe zi
        const tarifMatch = norm.match(/(?:pret|tarif)\s*(?:pe zi|\/zi|zi)\s*[:\-]?\s*([0-9\.,]+)/i);
        if (tarifMatch && !data.rent.pret_facturat) {
          data.rent.pret_facturat = parseMoney(tarifMatch[1]);
        }

        // Total Rent
        const totalMatch = norm.match(/(?:total\s*(?:de plata|factura|general)?)\s*[:\-]?\s*([0-9\., ]+)\s*(?:lei|ron)/i);
        if (totalMatch && !data.rent.valoare_desp_rent_facturata) {
          data.rent.valoare_desp_rent_facturata = parseMoney(totalMatch[1]);
        }

        // Auto Închiriat
        const autoRentMatch = norm.match(/(?:autoturism|auto|vehicul)\s*(?:inchiriat|la schimb)?\s*[:\-]?\s*([A-Z0-9\.\- ]{3,30})/i);
        if (autoRentMatch && !data.rent.auto_inchiriat_marca) {
          data.rent.auto_inchiriat_marca = autoRentMatch[1].trim();
        }
      }

      return data;
    }
  }

  // --- 4. Subagent Coordonator Principal: Inspector Daune Auto ---
  class DamageClaimInspectorAgent {
    constructor() {
      this.store = new LearningStore();
      this.classifier = new DocumentClassifierSubagent(this.store);
      this.partyAuditor = new DamagedPartyAuditorSubagent();
      this.conformityAuditor = new DocumentConformitySubagent();
      this.cessionSubagent = new CessionContractSubagent();
      this.invoiceSubagent = new InvoicesAndEstimatesSubagent();
    }

    /**
     * Inspectează un pachet de fișiere PDF (fiecare cu name și text)
     * @param {Array<{name: string, text: string, pages: Array<string>}>} rawDocuments
     */
    async inspectDosar(rawDocuments) {
      // Pas 1: Clasificare documente
      const classifiedDocs = rawDocuments.map(doc => {
        const cl = this.classifier.classify(doc.text, doc.name);
        return {
          ...doc,
          classification: cl
        };
      });

      // Pas 2: Identificare parte păgubită
      const damagedParty = this.partyAuditor.audit(classifiedDocs);

      // Pas 3: Verificare Cesiune de Creanță
      const cession = this.cessionSubagent.audit(classifiedDocs);

      // Pas 4: Audit Conformitate Juridică și Administrativă
      const conformity = this.conformityAuditor.audit(damagedParty, classifiedDocs, cession);

      // Pas 5: Extracție Detaliată din Facturi și Devize
      const invoicesData = this.invoiceSubagent.audit(classifiedDocs);

      // Pas 6: Creare Mapare Finală pentru Formular
      const formFields = {
        nume_pagubit: damagedParty.nume_pagubit || '',
        marca_model: damagedParty.marca_model || '',
        numar_inmatriculare: damagedParty.numar_inmatriculare || '',
        // Factură reparație
        rep_factura_nr: invoicesData.reparatie.rep_factura_nr || '',
        rep_factura_data: invoicesData.reparatie.rep_factura_data || '',
        rep_emitent: invoicesData.reparatie.rep_emitent || '',
        rep_cui: invoicesData.reparatie.rep_cui || '',
        valoare_desp_rep_facturata: invoicesData.reparatie.valoare_desp_rep_facturata || '',
        rep_total: invoicesData.reparatie.rep_total || '',
        ora_manopera_facturata: invoicesData.reparatie.ora_manopera_facturata || '',
        rep_start: invoicesData.reparatie.rep_start || '',
        rep_end: invoicesData.reparatie.rep_end || '',
        ore_tinichigerie: invoicesData.reparatie.ore_tinichigerie || 0,
        ore_vopsitorie: invoicesData.reparatie.ore_vopsitorie || 0,
        // Factură rent
        rent_factura_nr: invoicesData.rent.rent_factura_nr || '',
        rent_factura_data: invoicesData.rent.rent_factura_data || '',
        rent_emitent: invoicesData.rent.rent_emitent || '',
        rent_cui: invoicesData.rent.rent_cui || '',
        rent_start: invoicesData.rent.rent_start || '',
        rent_end: invoicesData.rent.rent_end || '',
        zile_facturate: invoicesData.rent.zile_facturate || '',
        pret_facturat: invoicesData.rent.pret_facturat || '',
        auto_inchiriat_marca: invoicesData.rent.auto_inchiriat_marca || '',
        valoare_desp_rent_facturata: invoicesData.rent.valoare_desp_rent_facturata || ''
      };

      // Mapează cesionarul dacă există cesiune
      if (cession.has_cession && cession.cesionar) {
        formFields.nume_cesionar = cession.cesionar.nume_cesionar || '';
        formFields.cui_cesionar = cession.cesionar.cui_cesionar || '';
        formFields.cont_iban_cesionar = cession.cesionar.cont_iban_cesionar || '';
        formFields.banca_cesionar = cession.cesionar.banca_cesionar || '';
        formFields.adresa_cesionar = cession.cesionar.adresa_cesionar || '';
        formFields.reprezentant_cesionar = cession.cesionar.reprezentant_cesionar || '';
      }

      return {
        timestamp: new Date().toISOString(),
        documentsCount: rawDocuments.length,
        documents: classifiedDocs,
        damagedParty,
        cession,
        conformity,
        invoicesData,
        formFields
      };
    }
  }

  // Export către namespace-ul global
  global.CalculAutoRentInspector = {
    DamageClaimInspectorAgent,
    LearningStore,
    instance: new DamageClaimInspectorAgent()
  };

})(typeof window !== 'undefined' ? window : this);
