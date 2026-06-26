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
          {
            prompt: "Un agent commercial qui collabore avec une agence doit détenir :",
            choices: ["Sa propre carte T", "Une attestation d'habilitation (carte blanche) délivrée via le titulaire de la carte", "Rien de particulier", "Une carte G"],
            correctIndex: 1,
            explanation: "Le négociateur agit sous l'habilitation du titulaire de la carte : il reçoit une attestation (« carte blanche »).",
          },
          {
            prompt: "La garantie financière est obligatoire pour l'agent qui :",
            choices: ["Ne fait que de la transaction sans détenir de fonds", "Détient des fonds pour le compte de tiers", "Travaille seul", "Possède la carte T"],
            correctIndex: 1,
            explanation: "La garantie financière couvre les fonds détenus pour autrui (typiquement en gestion). Sans maniement de fonds, une mention « ne reçoit aucun fonds » est possible.",
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
          {
            prompt: "Dans un mandat exclusif, la clause qui sanctionne le vendeur traitant en direct est :",
            choices: ["La clause résolutoire", "La clause pénale", "La clause suspensive", "La clause de réserve"],
            correctIndex: 1,
            explanation: "La clause pénale prévoit une indemnité due à l'agence si le mandant vend sans elle pendant l'exclusivité.",
          },
          {
            prompt: "La durée d'irrévocabilité usuelle d'un mandat exclusif est :",
            choices: ["1 semaine", "3 mois", "1 an", "Illimitée"],
            correctIndex: 1,
            explanation: "L'exclusivité est souvent ferme 3 mois, puis résiliable avec préavis ; la durée totale reste limitée.",
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
          {
            prompt: "Quelle est la durée de validité d'un DPE réalisé depuis juillet 2021 ?",
            choices: ["1 an", "3 ans", "6 ans", "10 ans"],
            correctIndex: 3,
            explanation: "Le DPE est valable 10 ans (avec des dispositions transitoires pour les DPE antérieurs).",
          },
          {
            prompt: "Le diagnostic plomb (CREP) est exigé pour les logements construits avant :",
            choices: ["1949", "1975", "1997", "2005"],
            correctIndex: 0,
            explanation: "Le CREP concerne les immeubles d'habitation construits avant le 1ᵉʳ janvier 1949.",
          },
          {
            prompt: "L'état des risques (ERP) a une durée de validité de :",
            choices: ["6 mois", "1 an", "3 ans", "Illimitée"],
            correctIndex: 0,
            explanation: "L'ERP doit dater de moins de 6 mois au moment de la promesse puis de l'acte.",
          },
        ],
      },
      {
        title: "Loi ALUR & obligations d'information",
        description: "Honoraires affichés, informations copropriété, mandats.",
        questions: [
          {
            prompt: "Les honoraires d'agence affichés doivent l'être :",
            choices: ["Hors taxes", "TTC, et indiquer qui en a la charge", "Uniquement en vitrine", "À la libre appréciation de l'agence"],
            correctIndex: 1,
            explanation: "La loi ALUR impose l'affichage des honoraires TTC et la mention du payeur (vendeur/acquéreur).",
          },
          {
            prompt: "La loi ALUR a rendu obligatoire dans les copropriétés :",
            choices: ["Un fonds de travaux", "Un gardien", "Une assurance décennale", "Un syndic bénévole"],
            correctIndex: 0,
            explanation: "Un fonds de travaux (alimenté annuellement) est obligatoire dans la plupart des copropriétés.",
          },
        ],
      },
      {
        title: "RGPD & protection des données clients",
        description: "Collecte, conservation, droit à l'effacement des données prospects.",
        questions: [
          {
            prompt: "Selon le RGPD, les données d'un prospect doivent être :",
            choices: ["Conservées indéfiniment", "Collectées pour une finalité précise et conservées une durée limitée", "Partagées librement entre agences", "Vendues si le prospect ne répond pas"],
            correctIndex: 1,
            explanation: "Principes de finalité et de minimisation : on ne garde que le nécessaire, le temps nécessaire.",
          },
        ],
      },
      {
        title: "Lutte anti-blanchiment (TRACFIN)",
        description: "Vigilance, identification du client, déclaration de soupçon.",
        questions: [
          {
            prompt: "En cas de soupçon de blanchiment, l'agent immobilier doit :",
            choices: ["Refuser la vente sans rien dire", "Effectuer une déclaration de soupçon à TRACFIN", "Prévenir directement le client", "Contacter la police municipale"],
            correctIndex: 1,
            explanation: "L'agent est assujetti LCB-FT : déclaration à TRACFIN, sans en informer le client.",
          },
        ],
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
        questions: [
          {
            prompt: "La « pige » consiste principalement à :",
            choices: ["Estimer un bien", "Repérer les annonces de particuliers (PAP) pour proposer ses services", "Rédiger un compromis", "Faire visiter un bien"],
            correctIndex: 1,
            explanation: "La pige cible les biens vendus de particulier à particulier pour décrocher des mandats.",
          },
        ],
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
        questions: [
          {
            prompt: "Qualifier un acquéreur, c'est notamment vérifier :",
            choices: ["Sa couleur préférée", "Son besoin réel et sa capacité de financement", "Son signe astrologique", "Le nombre de visites déjà faites uniquement"],
            correctIndex: 1,
            explanation: "Besoin + budget + financement + motivation = acquéreur qualifié, donc transformable.",
          },
        ],
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
        questions: [
          {
            prompt: "Un bien loué 12 000 €/an estimé sur un rendement de 6 % vaut environ :",
            choices: ["72 000 €", "120 000 €", "200 000 €", "300 000 €"],
            correctIndex: 2,
            explanation: "Valeur = loyer annuel / taux = 12 000 / 0,06 = 200 000 €.",
          },
        ],
      },
      {
        title: "Analyse du marché local",
        description: "Tendances, délais de vente, stock, typologies demandées.",
      },
      {
        title: "Rédiger un avis de valeur",
        description: "Structurer, argumenter, présenter au vendeur.",
        questions: [
          {
            prompt: "Un avis de valeur établi par un agent immobilier :",
            choices: ["A la même valeur qu'une expertise judiciaire", "Est une estimation argumentée, sans valeur d'expertise officielle", "Est obligatoire pour vendre", "Fixe définitivement le prix de vente"],
            correctIndex: 1,
            explanation: "L'avis de valeur n'est pas une expertise : c'est une estimation motivée d'aide à la décision.",
          },
        ],
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
          {
            prompt: "La différence principale entre compromis et promesse unilatérale de vente :",
            choices: ["Le compromis engage les deux parties (synallagmatique)", "La promesse engage les deux parties", "Aucune différence", "Le compromis n'engage personne"],
            correctIndex: 0,
            explanation: "Le compromis (promesse synallagmatique) engage vendeur ET acquéreur ; la promesse unilatérale n'engage que le vendeur, contre indemnité d'immobilisation.",
          },
          {
            prompt: "La condition suspensive d'obtention de prêt protège :",
            choices: ["Le vendeur", "L'acquéreur, qui récupère son dépôt si le prêt est refusé", "L'agence", "Le notaire"],
            correctIndex: 1,
            explanation: "Si le prêt est refusé dans les conditions prévues, la vente tombe et l'acquéreur récupère son dépôt.",
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
        questions: [
          {
            prompt: "Le mandat de gestion permet à l'agence de :",
            choices: ["Vendre le bien sans accord", "Gérer la location pour le compte du propriétaire (loyers, quittances, travaux…)", "Habiter le logement", "Modifier le bail librement"],
            correctIndex: 1,
            explanation: "Le gestionnaire agit au nom du bailleur : encaissement, quittancement, suivi, reddition de comptes.",
          },
        ],
      },
      {
        title: "Constitution du dossier locataire",
        description: "Pièces, solvabilité, garants, cadre légal des justificatifs.",
        questions: [
          {
            prompt: "Quelle pièce un bailleur N'A PAS le droit d'exiger d'un candidat locataire ?",
            choices: ["Pièce d'identité", "Justificatifs de revenus", "Photo d'identité / carte vitale", "Justificatif de domicile"],
            correctIndex: 2,
            explanation: "La liste des pièces exigibles est limitée par décret : photo, carte vitale, RIB, dossier médical… sont interdits.",
          },
        ],
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
          {
            prompt: "Pour une location meublée (résidence principale), la durée du bail est de :",
            choices: ["1 an (ou 9 mois pour un étudiant)", "3 ans", "6 ans", "Libre"],
            correctIndex: 0,
            explanation: "Bail meublé : 1 an renouvelable, ou 9 mois non renouvelable pour un étudiant.",
          },
          {
            prompt: "Le dépôt de garantie d'une location vide est plafonné à :",
            choices: ["1 mois de loyer hors charges", "2 mois de loyer", "3 mois de loyer", "Aucun plafond"],
            correctIndex: 0,
            explanation: "1 mois hors charges en location vide ; 2 mois en meublé.",
          },
        ],
      },
      {
        title: "Quittancement & révision de loyer",
        description: "Appels de loyer, indice IRL, régularisation des charges.",
        questions: [
          {
            prompt: "L'indice utilisé pour réviser un loyer d'habitation est :",
            choices: ["L'IRL (Indice de Référence des Loyers)", "L'indice du coût de la construction (ICC)", "L'inflation INSEE générale", "Le taux du Livret A"],
            correctIndex: 0,
            explanation: "La révision annuelle d'un loyer d'habitation s'indexe sur l'IRL publié par l'INSEE.",
          },
        ],
      },
      {
        title: "Préavis & congés",
        description: "Préavis locataire/bailleur, zones tendues, motifs de congé.",
        questions: [
          {
            prompt: "Le préavis de départ d'un locataire d'un logement vide est de :",
            choices: ["1 mois partout", "3 mois, réduit à 1 mois en zone tendue ou cas particuliers", "6 mois", "Aucun préavis"],
            correctIndex: 1,
            explanation: "3 mois en principe (vide), 1 mois en zone tendue, mutation, perte d'emploi, etc. ; 1 mois en meublé.",
          },
          {
            prompt: "Le congé donné par le bailleur (logement vide) doit respecter un préavis de :",
            choices: ["1 mois", "3 mois", "6 mois avant l'échéance du bail, et être motivé", "Il peut être donné à tout moment"],
            correctIndex: 2,
            explanation: "Congé pour vente, reprise ou motif légitime : 6 mois avant la fin du bail, motivé.",
          },
        ],
      },
      {
        title: "Sinistres, travaux & passoires thermiques",
        description: "Gestion des sinistres, répartition des travaux, calendrier DPE F/G.",
        questions: [
          {
            prompt: "Depuis 2025, quels logements sont progressivement interdits à la location (passoires) ?",
            choices: ["Classe A", "Classe C", "Classe G puis F, puis E", "Tous les meublés"],
            correctIndex: 2,
            explanation: "Calendrier : G interdit en 2025, F en 2028, E en 2034 (logements résidence principale).",
          },
        ],
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
        questions: [
          {
            prompt: "Dans ICS, la « GED » désigne :",
            choices: ["La gestion électronique des documents", "Un type de mandat", "Le grand écran de diffusion", "Une taxe"],
            correctIndex: 0,
            explanation: "GED = Gestion Électronique des Documents : la bibliothèque numérique des pièces (baux, EDL…).",
          },
        ],
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
        questions: [
          {
            prompt: "La signature électronique qualifiée :",
            choices: ["N'a aucune valeur légale", "A la même valeur juridique qu'une signature manuscrite", "Est interdite pour les mandats", "Nécessite un huissier à chaque fois"],
            correctIndex: 1,
            explanation: "Encadrée par le règlement eIDAS, la signature électronique a valeur légale.",
          },
        ],
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
        questions: [
          {
            prompt: "Le code de déontologie des agents immobiliers impose notamment :",
            choices: ["De cacher les défauts du bien", "Transparence, loyauté et information du client", "De privilégier l'acquéreur le plus offrant uniquement", "De ne jamais écrire de mandat"],
            correctIndex: 1,
            explanation: "Décret de 2015 : compétence, transparence, confraternité, défense des intérêts du client.",
          },
        ],
      },
      {
        title: "Communication & écoute active",
        description: "Reformulation, questionnement, langage non verbal.",
        questions: [
          {
            prompt: "L'écoute active repose surtout sur :",
            choices: ["Parler le plus possible", "Reformuler et questionner pour comprendre le besoin", "Couper la parole", "Imposer son avis"],
            correctIndex: 1,
            explanation: "Questionner, reformuler, valider : on comprend avant de proposer.",
          },
        ],
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
        questions: [
          {
            prompt: "Pour de bonnes photos d'un bien, on privilégie :",
            choices: ["Des pièces encombrées", "Lumière naturelle, rangement et grand angle maîtrisé", "Le flash systématique de nuit", "Des photos floues d'ambiance"],
            correctIndex: 1,
            explanation: "Désencombrer, ouvrir les rideaux, photographier de jour : la première visite se joue en ligne.",
          },
        ],
      },
      {
        title: "Rédiger une annonce attractive",
        description: "Titre, accroche, description, mots-clés, conformité légale.",
        questions: [
          {
            prompt: "Une annonce immobilière doit obligatoirement mentionner :",
            choices: ["Le nom du propriétaire", "La classe énergie (DPE) et les honoraires", "Le montant de l'emprunt du vendeur", "La religion du quartier"],
            correctIndex: 1,
            explanation: "Mentions obligatoires : DPE (étiquette énergie/GES), honoraires TTC et charge, surface, etc.",
          },
        ],
      },
      {
        title: "Réseaux sociaux & personal branding",
        description: "Présence en ligne, ligne éditoriale, image de l'agence.",
      },
    ],
  },
];
