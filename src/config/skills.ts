/**
 * Catalogue des compétences — maisons de retraite, soins et services associés.
 * La valeur enregistrée est l'identifiant (anglais, minuscules) ; l'affichage et la recherche suivent la langue choisie
 * (on peut taper « aide-soignant » ou « carer » : les deux sont trouvés).
 */
export type SkillGroup = "care" | "nursing" | "home" | "kitchen" | "activities" | "admin" | "training";
export type Skill = { id: string; fr: string; en: string; group: SkillGroup };

const S = (id: string, fr: string, en: string, group: SkillGroup): Skill => ({ id, fr, en, group });

export const SKILL_CATALOG: Skill[] = [
  // Soins & accompagnement
  S("carer", "Aide-soignant(e) / Carer", "Carer", "care"),
  S("care", "Soins et accompagnement", "Care", "care"),
  S("support worker", "Accompagnant(e) (Support Worker)", "Support worker", "care"),
  S("care assistant", "Aide-soignant(e)", "Care assistant", "care"),
  S("senior care assistant", "Aide-soignant(e) principal(e)", "Senior care assistant", "care"),
  S("healthcare assistant", "Assistant(e) de santé", "Healthcare assistant", "care"),
  S("clinical support worker", "Assistant(e) clinique", "Clinical support worker", "care"),
  S("healthcare support worker", "Agent de soutien en santé", "Healthcare support worker", "care"),
  S("personal care", "Soins personnels", "Personal care", "care"),
  S("elderly care", "Soins aux personnes âgées", "Elderly care", "care"),
  S("dementia care", "Soins liés à la démence", "Dementia care", "care"),
  S("palliative care", "Soins palliatifs", "Palliative care", "care"),
  S("learning disability support", "Accompagnement du handicap intellectuel", "Learning disability support", "care"),
  S("disability care", "Accompagnement du handicap", "Disability care", "care"),
  S("domiciliary care", "Soins à domicile", "Domiciliary care", "care"),
  S("residential care", "Soins en établissement", "Residential care", "care"),
  S("night care", "Soins de nuit (veille)", "Night care (waking night)", "care"),
  S("sleep-in", "Présence de nuit (sleep-in)", "Sleep-in", "care"),
  S("live-in care", "Soins à demeure", "Live-in care", "care"),
  S("personal hygiene support", "Aide à l’hygiène personnelle", "Personal hygiene support", "care"),
  S("mobility assistance", "Aide à la mobilité", "Mobility assistance", "care"),
  S("nutrition and hydration", "Nutrition et hydratation", "Nutrition and hydration", "care"),
  S("companionship", "Compagnie et soutien moral", "Companionship", "care"),
  // Soins infirmiers
  S("nurse", "Infirmier(ère)", "Nurse", "nursing"),
  S("rgn", "Infirmier(ère) diplômé(e) d’État (RGN)", "Registered General Nurse (RGN)", "nursing"),
  S("registered nurse", "Infirmier(ère) diplômé(e)", "Registered nurse", "nursing"),
  S("staff nurse", "Infirmier(ère) de service", "Staff nurse", "nursing"),
  S("nurse practitioner", "Infirmier(ère) praticien(ne)", "Nurse practitioner", "nursing"),
  S("mental health nursing", "Soins infirmiers en santé mentale", "Mental health nursing", "nursing"),
  S("community nursing", "Soins infirmiers communautaires", "Community nursing", "nursing"),
  S("midwife", "Sage-femme", "Midwife", "nursing"),
  S("medication administration", "Administration des médicaments", "Medication administration", "nursing"),
  S("wound care", "Soins des plaies", "Wound care", "nursing"),
  S("vital signs monitoring", "Surveillance des signes vitaux", "Vital signs monitoring", "nursing"),
  S("patient observation", "Surveillance des patients", "Patient observation", "nursing"),
  S("phlebotomy", "Prélèvements sanguins", "Phlebotomy", "nursing"),
  S("ecg", "ECG", "ECG", "nursing"),
  S("care planning", "Planification des soins", "Care planning", "nursing"),
  S("clinical documentation", "Documentation clinique", "Clinical documentation", "nursing"),
  S("physiotherapy", "Kinésithérapie", "Physiotherapy", "nursing"),
  S("occupational therapy", "Ergothérapie", "Occupational therapy", "nursing"),
  S("clinical leadership", "Encadrement clinique", "Clinical leadership", "nursing"),
  // Entretien & maison
  S("housekeeper", "Agent d’entretien / Housekeeper", "Housekeeper", "home"),
  S("cleaner", "Agent de nettoyage", "Cleaner", "home"),
  S("laundry assistant", "Agent de blanchisserie", "Laundry assistant", "home"),
  S("maintenance", "Maintenance / bricolage", "Maintenance / handyman", "home"),
  S("gardener", "Jardinier(ère)", "Gardener", "home"),
  S("domestic assistant", "Agent de service", "Domestic assistant", "home"),
  // Cuisine & restauration
  S("chef", "Chef / Cuisinier(ère)", "Chef", "kitchen"),
  S("cook", "Cuisinier(ère)", "Cook", "kitchen"),
  S("kitchen assistant", "Aide de cuisine", "Kitchen assistant", "kitchen"),
  S("catering assistant", "Agent de restauration", "Catering assistant", "kitchen"),
  S("dining assistant", "Aide au service des repas", "Dining assistant", "kitchen"),
  S("food hygiene", "Hygiène alimentaire", "Food hygiene", "kitchen"),
  // Vie sociale
  S("activities coordinator", "Animateur(trice) / Activités", "Activities coordinator", "activities"),
  S("wellbeing", "Bien-être des résidents", "Resident wellbeing", "activities"),
  S("hairdresser", "Coiffeur(se)", "Hairdresser", "activities"),
  S("driver / own transport", "Chauffeur / véhicule personnel", "Driver / own transport", "activities"),
  S("bilingual / multilingual", "Bilingue / multilingue", "Bilingual / multilingual", "activities"),
  // Administration & encadrement
  S("receptionist", "Réceptionniste", "Receptionist", "admin"),
  S("care coordination", "Coordination des soins", "Care coordination", "admin"),
  S("healthcare administration", "Administration de santé", "Healthcare administration", "admin"),
  S("team leader", "Chef d’équipe", "Team leader", "admin"),
  S("deputy manager", "Directeur(trice) adjoint(e)", "Deputy manager", "admin"),
  S("registered manager", "Directeur(trice) d’établissement (Registered Manager)", "Registered manager", "admin"),
  // Formations & certificats
  S("care certificate", "Care Certificate", "Care Certificate", "training"),
  S("nvq level 2", "NVQ niveau 2", "NVQ level 2", "training"),
  S("nvq level 3", "NVQ niveau 3", "NVQ level 3", "training"),
  S("dbs checked", "Casier vérifié (DBS)", "DBS checked", "training"),
  S("first aid", "Premiers secours", "First aid", "training"),
  S("basic life support (bls)", "Réanimation de base (BLS)", "Basic life support (BLS)", "training"),
  S("moving and handling", "Manutention et mobilisation", "Moving and handling", "training"),
  S("infection prevention and control", "Prévention et contrôle des infections", "Infection prevention and control", "training"),
  S("safeguarding adults", "Protection des adultes vulnérables", "Safeguarding adults", "training"),
  S("fire safety", "Sécurité incendie", "Fire safety", "training"),
];

export const SKILL_GROUPS: Record<SkillGroup, { fr: string; en: string }> = {
  care: { fr: "Soins et accompagnement", en: "Care and support" },
  nursing: { fr: "Soins infirmiers", en: "Nursing" },
  home: { fr: "Entretien et maison", en: "Housekeeping" },
  kitchen: { fr: "Cuisine et repas", en: "Kitchen and dining" },
  activities: { fr: "Vie sociale et autres", en: "Social life and other" },
  admin: { fr: "Administration et encadrement", en: "Admin and management" },
  training: { fr: "Formations et certificats", en: "Training and certificates" },
};

const BY_ID = new Map(SKILL_CATALOG.map((s) => [s.id, s]));
// Anciennes valeurs enregistrées dans la base (compatibilité).
const LEGACY: Record<string, string> = { "dbs / background checked": "dbs checked", "phlebotomist": "phlebotomy", "first aid at work": "first aid" };

export const SKILLS = SKILL_CATALOG.map((s) => s.en);
export function skillLabel(id: string, locale: "fr" | "en"): string {
  const key = id.trim().toLowerCase();
  const s = BY_ID.get(key) ?? BY_ID.get(LEGACY[key] ?? "");
  if (s) return s[locale];
  return id.replace(/\b\w/g, (c) => c.toUpperCase());
}
