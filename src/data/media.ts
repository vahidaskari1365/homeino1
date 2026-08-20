// Central media pool (real stock photography via Pexels CDN)
// Keeps mock data clean & image URLs maintainable.

const p = (id: number, ext: "jpeg" | "png" = "jpeg", w = 1200, h = 800) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;

export const IMG = {
  // Living rooms / sofas (landscape)
  living1: p(6980724),
  living2: p(8089172),
  living3: p(6970059),
  living4: p(6438762),
  living5: p(8135496),
  living6: p(6958126),
  living7: p(6970049),
  living8: p(7214166),
  living9: p(6585599),
  living10: p(6580396),

  // Bedrooms / furniture (landscape)
  bed1: p(2062431),
  bed2: p(2082093),
  bed3: p(2082095),
  bed4: p(7614411),
  bed5: p(7214332),
  bed6: p(6890413),
  bed7: p(12607553),
  bed8: p(6527036),
  bed9: p(6970025),
  bed10: p(9565779),

  // Interior style guide — curated Pexels photography matched to each style.
  styleModern: p(1571460),
  styleMinimal: p(12277220),
  styleScandinavian: p(20390760),
  styleClassic: p(11433090),
  styleNeoclassical: p(12277282),
  styleIndustrial: p(7587827),
  styleBoho: p(20541968),
  styleRustic: p(7746106),
  styleJapandi: p(12285892),
  styleMediterranean: p(4846221),
  styleContemporary: p(6969866),
  styleArtDeco: p(31080809),

  // Decor / objects (square)
  decor1: p(32631105, "jpeg", 900, 900),
  decor2: p(33948970, "png", 900, 900),
  decor3: p(38986381, "jpeg", 900, 900),
  decor4: p(38986380, "jpeg", 900, 900),
  decor5: p(38986382, "jpeg", 900, 900),
  decor6: p(38908537, "jpeg", 900, 900),
  decor7: p(38986383, "jpeg", 900, 900),
  decor8: p(27165068, "jpeg", 900, 900),
  decor9: p(18633243, "jpeg", 900, 900),
  decor10: p(38241046, "jpeg", 900, 900),
};

export const roomShots = [
  IMG.living1, IMG.living2, IMG.living3, IMG.living4, IMG.living5,
  IMG.living6, IMG.living7, IMG.living8, IMG.living9, IMG.living10,
  IMG.bed1, IMG.bed2, IMG.bed3, IMG.bed4, IMG.bed5,
  IMG.bed6, IMG.bed7, IMG.bed8, IMG.bed9, IMG.bed10,
];

export const decorShots = [
  IMG.decor1, IMG.decor2, IMG.decor3, IMG.decor4, IMG.decor5,
  IMG.decor6, IMG.decor7, IMG.decor8, IMG.decor9, IMG.decor10,
];
