// Deterministic fictitious data (spec section 5): 200 invented French merchants.
// Same output on every call, so a reset always restores the exact same offers.

import { OFFER_COUNT } from "@/lib/engine/config";
import { createRng, pick, shuffle, type Rng } from "@/lib/engine/random";
import type { Importance, Offer } from "@/lib/engine/types";

/** Seed for the fictitious data. Independent from the simulation seed (sim_state.seed). */
export const DATA_SEED = 2026;

export const IMPORTANCE_COUNTS: Readonly<Record<Importance, number>> = { A: 40, B: 80, C: 80 };

interface CategoryDef {
  name: string;
  heads: string[];
  offers: string[];
  extras: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    name: "Mode",
    heads: ["Atelier", "Maison", "Boutique", "Vestiaire"],
    offers: ["des vêtements et accessoires de saison", "des pièces intemporelles en matières naturelles", "du prêt-à-porter coloré pour toute la famille"],
    extras: ["Collections en séries limitées, confectionnées en France.", "Retours gratuits sous 30 jours.", "Chaque pièce est pensée pour durer."],
  },
  {
    name: "Beauté",
    heads: ["Savonnerie", "Institut", "Herboristerie"],
    offers: ["des soins naturels pour le visage et le corps", "des cosmétiques solides et sans emballage", "des parfums d'intérieur et des huiles essentielles"],
    extras: ["Formules courtes, fabriquées artisanalement.", "Conseils personnalisés en boutique et en ligne."],
  },
  {
    name: "Maison & déco",
    heads: ["Comptoir", "Fabrique", "Atelier"],
    offers: ["du linge de maison et des objets décoratifs", "de la vaisselle en céramique façonnée à la main", "des luminaires et du petit mobilier"],
    extras: ["Une sélection de créateurs indépendants.", "Livraison soignée partout en France."],
  },
  {
    name: "Épicerie fine",
    heads: ["Épicerie", "Cave", "Comptoir", "Maison"],
    offers: ["des produits du terroir et des spécialités régionales", "une sélection de vins, thés et cafés", "des confitures, miels et douceurs artisanales"],
    extras: ["Producteurs choisis à moins de 300 km.", "Coffrets cadeaux sur mesure."],
  },
  {
    name: "Sport & plein air",
    heads: ["Cycles", "Club", "Refuge"],
    offers: ["du matériel de randonnée et de camping", "des vélos et accessoires d'occasion révisés", "des équipements pour le yoga et le fitness"],
    extras: ["Atelier de réparation sur place.", "Sorties découverte organisées chaque mois."],
  },
  {
    name: "High-tech",
    heads: ["Studio", "Labo", "Atelier"],
    offers: ["des smartphones et ordinateurs reconditionnés", "des accessoires audio et objets connectés", "la réparation express de vos appareils"],
    extras: ["Garantie de 2 ans sur tous les produits.", "Diagnostic gratuit en moins de 24 h."],
  },
  {
    name: "Voyage",
    heads: ["Escales", "Agence", "Carnets"],
    offers: ["des séjours courts en France et en Europe", "des week-ends insolites clés en main", "des circuits à vélo et à pied"],
    extras: ["Conseillers disponibles 7 jours sur 7.", "Annulation flexible jusqu'à la veille."],
  },
  {
    name: "Restauration",
    heads: ["Bistrot", "Brasserie", "Table", "Café"],
    offers: ["une cuisine de saison faite maison", "des plats à emporter et des formules midi", "des brunchs gourmands le week-end"],
    extras: ["Produits frais livrés chaque matin.", "Terrasse ouverte dès les beaux jours."],
  },
  {
    name: "Bien-être",
    heads: ["Spa", "Studio", "Jardin"],
    offers: ["des massages et soins relaxants", "des cours de yoga, pilates et méditation", "des ateliers de sophrologie en petit groupe"],
    extras: ["Premier cours offert.", "Cartes cadeaux valables un an."],
  },
  {
    name: "Enfants & jeux",
    heads: ["Ludothèque", "Manège", "Cabane"],
    offers: ["des jouets en bois et des jeux de société", "des loisirs créatifs pour les 3 à 12 ans", "des vêtements pour bébés en coton biologique"],
    extras: ["Emballage cadeau offert.", "Animations gratuites le mercredi."],
  },
  {
    name: "Librairie & culture",
    heads: ["Librairie", "Papeterie", "Bouquinerie"],
    offers: ["des romans, beaux livres et bandes dessinées", "des carnets, stylos et fournitures d'art", "des livres d'occasion soigneusement sélectionnés"],
    extras: ["Rencontres d'auteurs chaque mois.", "Commande et retrait en 48 h."],
  },
  {
    name: "Jardin",
    heads: ["Pépinière", "Serre", "Jardinerie"],
    offers: ["des plantes d'intérieur et des semences anciennes", "des arbres fruitiers et arbustes de pays", "des outils et accessoires de jardinage durables"],
    extras: ["Conseils d'entretien offerts à chaque achat.", "Plantes cultivées sans pesticides."],
  },
];

const TAILS = [
  "Lumière", "Garance", "Sauge", "Ardoise", "Colombe", "Ambre", "Nacre", "Mistral", "Bastide",
  "Pervenche", "Olivier", "Cerisier", "Tilleul", "Capucine", "Azur", "Opale", "Galet", "Sirocco",
  "Brume", "Cannelle", "Velours", "Coquelicot", "Myrtille", "Lavande", "Céleste", "Écume",
  "Grenade", "Figuier", "Hirondelle", "Comète", "du Marais", "des Halles", "du Canal",
  "de la Fontaine", "du Port", "des Lilas", "de l'Abbaye", "du Moulin", "des Remparts", "de la Gare",
];

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueName(rng: Rng, category: CategoryDef, used: Set<string>): string {
  for (;;) {
    const name = `${pick(rng, category.heads)} ${pick(rng, TAILS)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
}

function describe(rng: Rng, name: string, category: CategoryDef): string {
  const first = `${name} propose ${pick(rng, category.offers)}.`;
  return rng() < 0.6 ? `${first} ${pick(rng, category.extras)}` : first;
}

/** The 200 fictitious offers in their initial order (`rank` = id). */
export function generateOffers(count: number = OFFER_COUNT, seed: number = DATA_SEED): Offer[] {
  const rng = createRng(seed);
  const used = new Set<string>();

  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const importanceById = new Map<number, Importance>();
  const shuffled = shuffle(rng, ids);
  const aEnd = Math.round((IMPORTANCE_COUNTS.A / OFFER_COUNT) * count);
  const bEnd = aEnd + Math.round((IMPORTANCE_COUNTS.B / OFFER_COUNT) * count);
  shuffled.forEach((id, index) => {
    importanceById.set(id, index < aEnd ? "A" : index < bEnd ? "B" : "C");
  });

  return ids.map((id) => {
    const category = pick(rng, CATEGORIES);
    const merchantName = uniqueName(rng, category, used);
    const slug = slugify(merchantName);
    return {
      id,
      rank: id,
      merchantName,
      slug,
      importance: importanceById.get(id)!,
      category: category.name,
      description: describe(rng, merchantName, category),
      url: `https://demo.invalid/m/${slug}`,
      imageUrl: `/media/image/${id}`,
      logoUrl: `/media/logo/${id}`,
    };
  });
}

let cache: Offer[] | null = null;

/** Memoized default seed (used by the SVG media routes). */
export function defaultOffers(): Offer[] {
  cache ??= generateOffers();
  return cache;
}
