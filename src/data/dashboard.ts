import type { Activity } from '../lib/activities'
import type { DashboardData, MealSlot } from '../types'

const IMG =
  'https://lh3.googleusercontent.com/aida-public/'

/** Libellé de la date du jour, tel qu'affiché et envoyé au modèle. */
function todayLabel(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

/** Décor de l'application : identité, en-tête et micronutriments encore simulés. */
export const dashboardData: DashboardData = {
  logoUrl: `${IMG}AB6AXuBqwUNKXolRRQWXLXRTBPImrHfPN86lvwQ02fvIFf0nvPdmWUUydkgE-Vqys4UmtBrzfSqmLwKMqlEKHv5C6_4_Qa3VTdf8eDiwUumDus4ORfVA3XsaU65PHS7O4uHmt38dbvIvHSoeMRZMRjiu0J2Uyyn8-WNcgIAMbKshZ2s5eNkkC_QuWS_wGILJsYtP23e34O-ILeQI8PqsmXyqwwmKYjwaS_E65R3XFypNPBTVx-VAsYLVbKM`,
  user: {
    name: 'Mon profil',
    avatarUrl: `${IMG}AB6AXuDlGnlzkQRlIzPgevMoAhnjIkIcB-4TJKDjxnFv1WEX5aEqCSItV9HZcLdWuWThVWm0AAPs1mYH7jdtt5DFY4AzFxeUFbcO1S05xqMOiRF_bCfi9d5lH_yzN_XaXlRUfF5uU8xOkKA7sGVp-99QIDFg6AsFZB8Bw2xSnoNfcFnmH5IiX8E5jfZY8QNNYqDA7H3C4MGytuWT3ARyTuN75lrkGTMyjHuo7lXZ4XdxHROYmrSVPeGxRNE`,
  },
  coach: { name: 'Dr. Anya' },
  dateLabel: todayLabel(),
  // Aucune table de composition n'est embarquée : ces valeurs restent simulées.
  micros: [
    { key: 'vit-d', label: 'Vit. D', percent: 60 },
    { key: 'vit-b12', label: 'Vit. B12', percent: 85 },
    { key: 'magnesium', label: 'Magnésium', percent: 45 },
  ],
}

/**
 * Illustration par créneau : le modèle ne renvoie pas d'image, on en associe une
 * de façon déterministe pour que le menu reste stable d'une génération à l'autre.
 */
export const SLOT_IMAGES: Record<MealSlot, { url: string; alt: string }> = {
  breakfast: {
    url: `${IMG}AB6AXuCsAlUi8dPEBO1kqKrUEvPmEQxAbFxPcZk_cRRJZ2zc09V5d2h4Bk-7JJhDkCrXAF15YQkaq-0ytipl9pBf4L4TEgYn-rIr8QkLzE7IrYZ9LfdPaf87V-ve2JdDj9kF-e_w5m1tjkhaOFvOZLgt_d5lScON6zdVx5t6TgmT3m7LY5f2oIW8IR6sOQ2SD5wKxMKWjUB94CDjS7FPWVhNPfuDg5YVK_VunpDKoUtnCITPmgnHdn9TVRs`,
    alt: "Bowl d'avoine crémeuse aux fruits rouges et graines de chia",
  },
  lunch: {
    url: `${IMG}AB6AXuBDD25eJrCROfVTCnJkzNBNxMww1JtJKvfCIPwfSVZFuMe5pO519NYssfftSQ-z0B0zLQSLE7WrLqNlRVUcsXeUmTKgOvPDOOomIHMEyC_edtpKZUq89JJZfctO96uD5ogO4JRdj32PU8YlhWOdnhgGWTYUEcHpZ9yW9H3-WZUDBkHJ5OC_4wf--Ya22UY_4RZnE5sqHwX0JxCFUEOWhCJJGuICOkZGNe2Vs42XbSRGfNofERgy4vk`,
    alt: 'Pavé de saumon grillé sur lit de quinoa vert et asperges rôties',
  },
  dinner: {
    url: `${IMG}AB6AXuDrxGkV_nFjrM1iuIW4ln5CXEqk_1T-A5ZqaX66175Yh5_jAEIFJSm0tICJfduaPwFtWVb_Juil6GR46Asxrwp6A-hN969id1hoeAFJ5o4fKu9mRcykbgYHe3XCkOjm_f_A-VqUcWuN3bnIZKgSeCIgfsk4-4RzRQa-Y_gyvgIQj1NOB9W-XkVHFHnafIMH0fo5Llf7GQRlm2tWqaN6PKzfgtYMa9XzCjjmtLz6Gq07_Ea6n6Am00A`,
    alt: 'Mijoté de lentilles et légumes rôtis dans un bol en céramique mate',
  },
  snack: {
    url: 'https://images.unsplash.com/photo-1591073113125-e46713c829ed?auto=format&fit=crop&q=80&w=800',
    alt: 'Amandes et pomme fraîche sur une planche en bois clair',
  },
}

/** Activités de la journée de démonstration, remplacées par la saisie réelle. */
export const defaultActivities: Activity[] = [
  {
    id: 'gym-morning',
    time: '07:00',
    typeId: 'gym',
    title: 'Gym & Réveil articulaire',
    durationMin: 25,
    impact: 'Métabolisme réveillé • Hydratation prioritaire',
  },
  {
    id: 'bike-commute',
    time: '11:30',
    typeId: 'bike',
    title: 'Trajet Vélo urbain',
    durationMin: 35,
    impact: 'Déjeuner réajusté : +0.5L hydratation & +15g glucides lents',
  },
]
