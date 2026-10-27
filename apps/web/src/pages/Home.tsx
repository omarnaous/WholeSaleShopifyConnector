import { useEffect } from "react";
import { useLocation } from "react-router";
import { useCatalog } from "../lib/catalog";
import { Hero } from "../sections/Hero";
import { Collections, Marquee } from "../sections/Collections";
import { LensLab } from "../sections/LensLab";
import { HowItWorks } from "../sections/HowItWorks";
import { CatalogPreview } from "../sections/CatalogPreview";
import { FAQ, FinalCTA, Pricing } from "../sections/Closing";
import { useScrollTo } from "../components/motion";

export default function Home() {
  const products = useCatalog();
  const { hash } = useLocation();
  const scrollTo = useScrollTo();
  useEffect(() => {
    document.title = "LUMEN — Wholesale eyewear for Shopify stores";
  }, []);
  // Deep links like /#pricing coming from other pages.
  useEffect(() => {
    if (!hash || !products) return;
    const t = setTimeout(() => scrollTo(hash), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, !!products]);

  return (
    <>
      <Hero />
      <Marquee items={["Polarized", "UV400", "Mirrored", "Gradient", "Titanium", "Bio-acetate", "Hand-polished", "Synced to Shopify"]} />
      <Collections products={products} />
      <LensLab />
      <HowItWorks products={products} />
      <CatalogPreview products={products} />
      <Pricing products={products} />
      <FAQ />
      <FinalCTA products={products} />
    </>
  );
}
