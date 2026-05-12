/* Reglages.jsx
 *
 * Fiche de réglages des identités pour le rapport CompteRendu :
 * - Mandant (vendeur) : civilité, prénom, nom, email, téléphone, adresse
 * - Agence : nom, adresse, téléphone, email, logo (URL), couleurs
 * - Agent : nom, fonction, email, téléphone, signature (URL)
 *
 * Les valeurs saisies sont persistées dans le reportStore (sections
 * `mandant`, `agence`, `agent`) et lues par CompteRendu via les
 * effective wrappers effMandant / effAgence / effAgent, qui retombent
 * sur les mocks propertyData en cas de champ vide.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mergeReportSection, getReportSection } from '../utils/reportStore';

const SECTIONS = [
  {
    key: 'mandant',
    title: 'Mandant (vendeur)',
    intro: 'Coordonnées du vendeur destinataire du rapport.',
    fields: [
      { key: 'civilite', label: 'Civilité', type: 'select', options: ['', 'M.', 'Mme', 'Mx'] },
      { key: 'prenom', label: 'Prénom' },
      { key: 'nom', label: 'Nom' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'telephone', label: 'Téléphone', type: 'tel' },
      { key: 'adresseCorrespondance', label: 'Adresse de correspondance', type: 'textarea' },
    ],
  },
  {
    key: 'agence',
    title: 'Agence',
    intro: 'Identité de l\'agence telle qu\'elle apparaît en couverture et dans la lettre.',
    fields: [
      { key: 'nom', label: 'Nom de l\'agence' },
      { key: 'adresse', label: 'Adresse', type: 'textarea' },
      { key: 'tel', label: 'Téléphone' },
      { key: 'email', label: 'Email' },
      { key: 'siteWeb', label: 'Site web' },
      { key: 'logo', label: 'URL du logo', type: 'url' },
      { key: 'couleurPrimaire', label: 'Couleur primaire (CSS)', type: 'color' },
      { key: 'couleurSecondaire', label: 'Couleur secondaire (CSS)', type: 'color' },
      { key: 'carteT', label: 'Carte professionnelle (carte T)' },
      { key: 'rcs', label: 'RCS / numéro légal' },
      { key: 'mentionsComplementaires', label: 'Mentions complémentaires', type: 'textarea' },
    ],
  },
  {
    key: 'agent',
    title: 'Agent immobilier',
    intro: 'Identité de l\'agent qui signe le rapport.',
    fields: [
      { key: 'nom', label: 'Nom complet' },
      { key: 'fonction', label: 'Fonction / titre' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'telDirect', label: 'Téléphone direct', type: 'tel' },
      { key: 'photo', label: 'URL photo', type: 'url' },
      { key: 'signature', label: 'URL signature scannée', type: 'url' },
    ],
  },
];

export default function Reglages() {
  const navigate = useNavigate();

  const initial = useMemo(() => ({
    mandant: getReportSection('mandant', {}),
    agence: getReportSection('agence', {}),
    agent: getReportSection('agent', {}),
  }), []);

  const [state, setState] = useState(initial);
  const [savedFlash, setSavedFlash] = useState(false);

  // Persistance automatique au changement
  useEffect(() => {
    mergeReportSection('mandant', state.mandant);
  }, [state.mandant]);
  useEffect(() => {
    mergeReportSection('agence', state.agence);
  }, [state.agence]);
  useEffect(() => {
    mergeReportSection('agent', state.agent);
  }, [state.agent]);

  const updateField = (sectionKey, fieldKey, value) => {
    setState((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [fieldKey]: value },
    }));
  };

  const handleSave = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const renderField = (sectionKey, field) => {
    const value = state[sectionKey][field.key] ?? '';
    const id = `${sectionKey}-${field.key}`;
    const common = {
      id,
      value,
      onChange: (e) => updateField(sectionKey, field.key, e.target.value),
      style: {
        width: '100%',
        padding: '8px 10px',
        fontSize: 14,
        border: '1px solid #d0d4d8',
        borderRadius: 6,
        background: '#fff',
        fontFamily: 'inherit',
      },
    };

    if (field.type === 'select') {
      return (
        <select {...common}>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt || '— Non renseigné —'}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return <textarea {...common} rows={3} />;
    }

    if (field.type === 'color') {
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={value || '#000000'} onChange={(e) => updateField(sectionKey, field.key, e.target.value)} />
          <input type="text" {...common} placeholder="#0066cc" />
        </div>
      );
    }

    return <input type={field.type || 'text'} {...common} />;
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Identités du rapport</h1>
          <p style={{ margin: '6px 0 0', color: '#666', fontSize: 14 }}>
            Ces informations apparaissent en couverture, dans la lettre et dans la fiche interlocuteur du compte-rendu.
            Les champs laissés vides utilisent les valeurs par défaut.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            ← Retour
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 14px',
              fontSize: 14,
              border: 'none',
              borderRadius: 6,
              background: savedFlash ? '#16a34a' : '#0066cc',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {savedFlash ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {SECTIONS.map((sec) => (
        <section
          key={sec.key}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '18px 20px',
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{sec.title}</h2>
          <p style={{ margin: '0 0 14px', color: '#666', fontSize: 13 }}>{sec.intro}</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px 18px',
            }}
          >
            {sec.fields.map((field) => {
              const isWide = field.type === 'textarea';
              return (
                <div
                  key={field.key}
                  style={{ gridColumn: isWide ? '1 / -1' : 'auto' }}
                >
                  <label
                    htmlFor={`${sec.key}-${field.key}`}
                    style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}
                  >
                    {field.label}
                  </label>
                  {renderField(sec.key, field)}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        Données stockées localement dans votre navigateur (clé <code>ideeri_report_state</code>).
        Aucune donnée n'est envoyée à un serveur tiers depuis cette page.
      </div>
    </div>
  );
}
