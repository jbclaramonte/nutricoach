import type { DashboardData } from '../types'

const IMG =
  'https://lh3.googleusercontent.com/aida-public/'

/**
 * Jeu de données de démonstration. Il sera remplacé par la base locale
 * (IndexedDB) et les menus générés par le LLM lors de la prochaine itération.
 */
export const dashboardData: DashboardData = {
  logoUrl: `${IMG}AB6AXuBqwUNKXolRRQWXLXRTBPImrHfPN86lvwQ02fvIFf0nvPdmWUUydkgE-Vqys4UmtBrzfSqmLwKMqlEKHv5C6_4_Qa3VTdf8eDiwUumDus4ORfVA3XsaU65PHS7O4uHmt38dbvIvHSoeMRZMRjiu0J2Uyyn8-WNcgIAMbKshZ2s5eNkkC_QuWS_wGILJsYtP23e34O-ILeQI8PqsmXyqwwmKYjwaS_E65R3XFypNPBTVx-VAsYLVbKM`,
  user: {
    name: 'Mon profil',
    avatarUrl: `${IMG}AB6AXuDlGnlzkQRlIzPgevMoAhnjIkIcB-4TJKDjxnFv1WEX5aEqCSItV9HZcLdWuWThVWm0AAPs1mYH7jdtt5DFY4AzFxeUFbcO1S05xqMOiRF_bCfi9d5lH_yzN_XaXlRUfF5uU8xOkKA7sGVp-99QIDFg6AsFZB8Bw2xSnoNfcFnmH5IiX8E5jfZY8QNNYqDA7H3C4MGytuWT3ARyTuN75lrkGTMyjHuo7lXZ4XdxHROYmrSVPeGxRNE`,
  },
  coach: { name: 'Dr. Anya' },
  banner: {
    highlight: 'Menu mis à jour :',
    message:
      "+200 fibres ajoutées suite à votre activité d'hier pour optimiser votre récupération.",
  },
  dateLabel: 'Jeu. 24 Octobre',
  macros: [
    { key: 'calories', label: 'Calories', display: '1.8k', percent: 65, strokeClass: 'stroke-tertiary-container' },
    { key: 'protein', label: 'Protéines', display: '85g', percent: 60, strokeClass: 'stroke-primary' },
    { key: 'fiber', label: 'Fibres', display: '24g', percent: 80, strokeClass: 'stroke-primary' },
    { key: 'water', label: 'Eau', display: '1.2L', percent: 40, strokeClass: 'stroke-secondary' },
  ],
  micros: [
    { key: 'vit-d', label: 'Vit. D', percent: 60 },
    { key: 'vit-b12', label: 'Vit. B12', percent: 85 },
    { key: 'magnesium', label: 'Magnésium', percent: 45 },
  ],
  meals: [
    {
      id: 'breakfast',
      slot: 'breakfast',
      slotLabel: 'Petit-déjeuner',
      title: 'Bowl Avoine & Fruits Rouges',
      imageAlt: "Bowl d'avoine crémeuse aux fruits rouges et graines de chia",
      imageUrl: `${IMG}AB6AXuCsAlUi8dPEBO1kqKrUEvPmEQxAbFxPcZk_cRRJZ2zc09V5d2h4Bk-7JJhDkCrXAF15YQkaq-0ytipl9pBf4L4TEgYn-rIr8QkLzE7IrYZ9LfdPaf87V-ve2JdDj9kF-e_w5m1tjkhaOFvOZLgt_d5lScON6zdVx5t6TgmT3m7LY5f2oIW8IR6sOQ2SD5wKxMKWjUB94CDjS7FPWVhNPfuDg5YVK_VunpDKoUtnCITPmgnHdn9TVRs`,
      eaten: true,
      items: [
        { name: "Flocons d'avoine", quantity: '60g', calories: 228, protein: 8.4, fiber: 6.1 },
        { name: 'Lait demi-écrémé', quantity: '200ml', calories: 92, protein: 6.8, fiber: null },
        { name: 'Fruits rouges', quantity: '100g', calories: 45, protein: 1, fiber: 4.5 },
        { name: 'Graines de chia', quantity: '15g', calories: 73, protein: 2.5, fiber: 5.2 },
        { name: 'Banane', quantity: '100g', calories: 89, protein: 1.1, fiber: 2.6 },
      ],
    },
    {
      id: 'lunch',
      slot: 'lunch',
      slotLabel: 'Déjeuner',
      title: 'Saumon Grillé & Quinoa Vert',
      imageAlt: 'Pavé de saumon grillé sur lit de quinoa vert et asperges rôties',
      imageUrl: `${IMG}AB6AXuBDD25eJrCROfVTCnJkzNBNxMww1JtJKvfCIPwfSVZFuMe5pO519NYssfftSQ-z0B0zLQSLE7WrLqNlRVUcsXeUmTKgOvPDOOomIHMEyC_edtpKZUq89JJZfctO96uD5ogO4JRdj32PU8YlhWOdnhgGWTYUEcHpZ9yW9H3-WZUDBkHJ5OC_4wf--Ya22UY_4RZnE5sqHwX0JxCFUEOWhCJJGuICOkZGNe2Vs42XbSRGfNofERgy4vk`,
      eaten: false,
      items: [
        { name: 'Pavé de saumon', quantity: '150g', calories: 310, protein: 31, fiber: null },
        { name: 'Quinoa cuit', quantity: '150g', calories: 180, protein: 6.6, fiber: 4.2 },
        { name: 'Asperges rôties', quantity: '120g', calories: 24, protein: 2.6, fiber: 2.5 },
        { name: 'Épinards frais', quantity: '60g', calories: 14, protein: 1.7, fiber: 1.3 },
        { name: "Huile d'olive", quantity: '1 c.s.', calories: 90, protein: null, fiber: null },
      ],
    },
    {
      id: 'dinner',
      slot: 'dinner',
      slotLabel: 'Dîner',
      title: 'Mijoté de Lentilles Douces',
      imageAlt: 'Mijoté de lentilles et légumes rôtis dans un bol en céramique mate',
      imageUrl: `${IMG}AB6AXuDrxGkV_nFjrM1iuIW4ln5CXEqk_1T-A5ZqaX66175Yh5_jAEIFJSm0tICJfduaPwFtWVb_Juil6GR46Asxrwp6A-hN969id1hoeAFJ5o4fKu9mRcykbgYHe3XCkOjm_f_A-VqUcWuN3bnIZKgSeCIgfsk4-4RzRQa-Y_gyvgIQj1NOB9W-XkVHFHnafIMH0fo5Llf7GQRlm2tWqaN6PKzfgtYMa9XzCjjmtLz6Gq07_Ea6n6Am00A`,
      badge: 'Suggestion Modifiée',
      eaten: false,
      items: [
        { name: 'Lentilles vertes cuites', quantity: '200g', calories: 232, protein: 18, fiber: 15.8 },
        { name: 'Carottes', quantity: '120g', calories: 49, protein: 1.1, fiber: 3.4 },
        { name: 'Courgette', quantity: '150g', calories: 26, protein: 1.8, fiber: 1.5 },
        { name: 'Oignon', quantity: '60g', calories: 24, protein: 0.7, fiber: 1 },
        { name: "Huile d'olive", quantity: '1 c.s.', calories: 90, protein: null, fiber: null },
      ],
    },
    {
      id: 'snack',
      slot: 'snack',
      slotLabel: 'Collation',
      title: 'Amandes et Pomme',
      imageAlt: 'Amandes et pomme fraîche sur une planche en bois clair',
      imageUrl:
        'https://images.unsplash.com/photo-1591073113125-e46713c829ed?auto=format&fit=crop&q=80&w=800',
      eaten: false,
      items: [
        { name: 'Amandes', quantity: '30g', calories: 175, protein: 6, fiber: 3.5 },
        { name: 'Pomme', quantity: '150g', calories: 75, protein: 0.5, fiber: 3.6 },
      ],
    },
  ],
}
