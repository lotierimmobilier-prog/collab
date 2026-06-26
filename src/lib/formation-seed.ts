// Programme type de formation des agents commerciaux immobiliers.
// Chargé via /api/formation/seed, puis entièrement modifiable dans l'admin.

export interface SeedQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
}
export interface SeedCompetence {
  title: string;
  description?: string;
  questions?: SeedQuestion[];
}
export interface SeedModule {
  title: string;
  description?: string;
  competences: SeedCompetence[];
}

export const FORMATION_SEED: SeedModule[] = [
  {
    title: "Cadre juridique & réglementaire",
    description: "Les fondamentaux légaux du métier d'agent immobilier.",
    competences: [
      {
        title: "Loi Hoguet & carte professionnelle",
        description: "Conditions d'exercice, carte T/G, attestation, garantie financière.",
        questions: [
          {
            prompt: "Que désigne la carte professionnelle « T » ?",
            choices: ["Gestion locative", "Transaction sur immeubles et fonds de commerce", "Syndic de copropriété", "Marchand de biens"],
            correctIndex: 1,
            explanation: "La carte T autorise l'activité de transaction ; la carte G concerne la gestion immobilière.",
          },
          {
            prompt: "Quelle est la durée de validité de la carte professionnelle ?",
            choices: ["1 an", "3 ans", "5 ans", "10 ans"],
            correctIndex: 1,
            explanation: "La carte professionnelle est délivrée pour 3 ans, renouvelable.",
          },
        ],
      },
      {
        title: "Le mandat (simple, exclusif, semi-exclusif)",
        description: "Mentions obligatoires, durée, numéro de registre, irrévocabilité.",
        questions: [
          {
            prompt: "Un mandat de vente doit obligatoirement être :",
            choices: ["Verbal", "Écrit et numéroté au registre des mandats", "Conclu chez le notaire", "D'une durée minimale de 1 an"],
            correctIndex: 1,
            explanation: "Tout mandat doit être écrit, en double exemplaire, et inscrit au registre des mandats.",
          },
        ],
      },
      {
        title: "Diagnostics obligatoires & DPE",
        description: "DPE, amiante, plomb, électricité, gaz, ERP, validité de chaque diagnostic.",
        questions: [
          {
            prompt: "Le DPE doit être réalisé :",
            choices: ["Après la signature du compromis", "Avant la mise en vente / location, dès l'annonce", "Uniquement à la demande de l'acquéreur", "Par l'agent immobilier lui-même"],
            correctIndex: 1,
            explanation: "Le DPE doit figurer dès l'annonce et être réalisé par un diagnostiqueur certifié.",
          },
        ],
      },
      {
        title: "Loi ALUR & obligations d'information",
        description: "Honoraires affichés, informations copropriété, mandats.",
      },
      {
        title: "RGPD & protection des données clients",
        description: "Collecte, conservation, droit à l'effacement des données prospects.",
      },
      {
        title: "Lutte anti-blanchiment (TRACFIN)",
        description: "Vigilance, identification du client, déclaration de soupçon.",
      },
    ],
  },
  {
    title: "Prospection & développement commercial",
    description: "Constituer et alimenter son portefeuille de mandats.",
    competences: [
      {
        title: "La pige immobilière",
        description: "Repérer les biens de particuliers, qualifier, organiser ses relances.",
      },
      {
        title: "Prospection terrain (boîtage, porte-à-porte)",
        description: "Secteur, fréquence, discours d'accroche, prise de contact physique.",
      },
      {
        title: "Prospection téléphonique",
        description: "Script d'appel, traitement des objections, prise de rendez-vous.",
        questions: [
          {
            prompt: "L'objectif principal d'un appel de prospection est :",
            choices: ["Vendre le bien au téléphone", "Décrocher un rendez-vous d'estimation", "Donner un prix immédiatement", "Conclure le mandat par téléphone"],
            correctIndex: 1,
            explanation: "Au téléphone, on ne vend pas : on obtient le rendez-vous.",
          },
        ],
      },
      {
        title: "Constitution du fichier acquéreurs",
        description: "Qualification du besoin, capacité de financement, alertes.",
      },
      {
        title: "Suivi et relance commerciale",
        description: "Cadence de relance, CRM, transformation prospect → mandat.",
      },
    ],
  },
  {
    title: "Estimation & connaissance du marché",
    description: "Évaluer un bien avec méthode et défendre son avis de valeur.",
    competences: [
      {
        title: "Méthode par comparaison",
        description: "Sélection des références, ajustements, prix au m².",
        questions: [
          {
            prompt: "La méthode par comparaison consiste à :",
            choices: ["Capitaliser les loyers", "Comparer à des biens similaires récemment vendus", "Appliquer le prix d'achat + travaux", "Prendre le prix du voisin"],
            correctIndex: 1,
            explanation: "On s'appuie sur des ventes comparables récentes du même secteur.",
          },
        ],
      },
      {
        title: "Méthode par capitalisation (rendement)",
        description: "Estimation d'un bien locatif à partir du rendement attendu.",
      },
      {
        title: "Analyse du marché local",
        description: "Tendances, délais de vente, stock, typologies demandées.",
      },
      {
        title: "Rédiger un avis de valeur",
        description: "Structurer, argumenter, présenter au vendeur.",
      },
    ],
  },
  {
    title: "Transaction & vente",
    description: "De la découverte acquéreur à la signature chez le notaire.",
    competences: [
      {
        title: "Prise de mandat",
        description: "Argumentaire, exclusivité, fixation du prix réaliste.",
      },
      {
        title: "Découverte acquéreur",
        description: "Cerner le besoin, le budget, le financement, la motivation.",
      },
      {
        title: "La visite",
        description: "Préparation, mise en valeur, sécurité, prise de température.",
      },
      {
        title: "Négociation",
        description: "Défendre le prix, gérer les contre-propositions, conclure.",
      },
      {
        title: "Offre d'achat & compromis",
        description: "Formalisme de l'offre, conditions suspensives, délai SRU.",
        questions: [
          {
            prompt: "Le délai de rétractation de l'acquéreur (loi SRU) est de :",
            choices: ["7 jours", "10 jours", "14 jours", "1 mois"],
            correctIndex: 1,
            explanation: "Depuis la loi Macron, l'acquéreur non professionnel dispose de 10 jours.",
          },
        ],
      },
      {
        title: "Suivi jusqu'à l'acte authentique",
        description: "Relation notaire, conditions suspensives, financement, signature.",
      },
    ],
  },
  {
    title: "Gestion locative",
    description: "Mandats de gestion, baux et relation propriétaire/locataire.",
    competences: [
      {
        title: "Le mandat de gestion",
        description: "Étendue, honoraires, reddition de comptes.",
      },
      {
        title: "Constitution du dossier locataire",
        description: "Pièces, solvabilité, garants, cadre légal des justificatifs.",
      },
      {
        title: "Le bail & l'état des lieux",
        description: "Bail loi 89, état des lieux d'entrée/sortie, dépôt de garantie.",
        questions: [
          {
            prompt: "Pour un logement vide en résidence principale, la durée du bail est de :",
            choices: ["1 an", "3 ans (bailleur personne physique)", "6 ans", "9 ans"],
            correctIndex: 1,
            explanation: "Bail de 3 ans pour un bailleur personne physique, 6 ans pour une personne morale.",
          },
        ],
      },
      {
        title: "Quittancement & révision de loyer",
        description: "Appels de loyer, indice IRL, régularisation des charges.",
      },
      {
        title: "Sinistres, travaux & congés",
        description: "Gestion des sinistres, devis, préavis et congés.",
      },
    ],
  },
  {
    title: "Logiciels & outils métier",
    description: "Maîtriser les outils du quotidien de l'agence.",
    competences: [
      {
        title: "ICS / Spirit (logiciel métier)",
        description: "Saisie des mandats, GED, fiches propriétaires/locataires, suivi.",
      },
      {
        title: "Collab (CRM interne)",
        description: "Tâches, annuaire, messagerie, planning, gestion et formation.",
      },
      {
        title: "Portails d'annonces (SeLoger, LeBonCoin, Bien'ici)",
        description: "Diffusion, qualité d'annonce, gestion des leads.",
      },
      {
        title: "Signature électronique",
        description: "Mandats et compromis signés à distance en toute valeur légale.",
      },
      {
        title: "Outils bureautiques & messagerie",
        description: "Mails professionnels, modèles de documents, agenda partagé.",
      },
    ],
  },
  {
    title: "Posture, déontologie & relation client",
    description: "Le savoir-être qui fait la différence.",
    competences: [
      {
        title: "Déontologie & éthique du métier",
        description: "Code de déontologie, conflits d'intérêts, transparence.",
      },
      {
        title: "Communication & écoute active",
        description: "Reformulation, questionnement, langage non verbal.",
      },
      {
        title: "Traitement des objections",
        description: "Identifier, accueillir et répondre aux freins du client.",
      },
      {
        title: "Fidélisation & recommandation",
        description: "Suivi post-vente, demande d'avis, bouche-à-oreille.",
      },
    ],
  },
  {
    title: "Marketing & outils digitaux",
    description: "Valoriser les biens et développer sa visibilité.",
    competences: [
      {
        title: "Photographie & valorisation du bien",
        description: "Prises de vue, lumière, home staging léger.",
      },
      {
        title: "Rédiger une annonce attractive",
        description: "Titre, accroche, description, mots-clés, conformité légale.",
      },
      {
        title: "Réseaux sociaux & personal branding",
        description: "Présence en ligne, ligne éditoriale, image de l'agence.",
      },
    ],
  },
];
