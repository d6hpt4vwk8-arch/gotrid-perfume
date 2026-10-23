// Structured product-page blocks for the K-beauty products whose facts are well documented (brand pages / retailer
// copy already used for their descriptions). Per-product specifics live here; the generic "how to use" steps and one
// general FAQ answer per product type are defaults in scripts/apply-product-details.ts. Facts only: nothing here goes
// beyond what the brand or retailer states, "what to expect" is phrased as the maker's claim.
// Slovak texts are written by hand (not machine-translated).

export interface Block {
  forWhom: string;
  ingredients: { name: string; text: string }[];
  expect: string;
  /** Replaces the type default steps. */
  howToUse?: string[];
  /** Product-specific questions, shown before the type default. */
  faq?: { q: string; a: string }[];
}

export interface Entry {
  /** Product.code */
  code: string;
  /** Type used for the default steps/FAQ (overrides Product.productType when set). */
  kind?: "foam" | "balm" | "mist" | "serum" | "cream" | "sun" | "sheet" | "eye" | "pad" | "toner-acid" | "essence" | "oil" | "spot";
  cs: Block;
  sk: Block;
}

export const ENTRIES: Entry[] = [
  // ───────────────────────────── Polatam (řada Cica Malacalming)
  {
    code: "GVS-3006318",
    kind: "cream",
    cs: {
      forWhom: "Pro suchou pleť, která potřebuje hydrataci a pocit vyživení. Řada Cica Malacalming od Polatam míří na citlivou, snadno podrážděnou pleť.",
      ingredients: [
        { name: "Centella asijská", text: "Základ receptury řady, tradičně používaná na zklidnění pleti." },
        { name: "Kyselina hyaluronová", text: "Pomáhá vázat vlhkost, takže pleť zůstává hydratovaná." },
        { name: "Ceramid NP, sheabutter a skvalan", text: "Vyživují pleť a pomáhají udržet její ochrannou bariéru." },
      ],
      expect: "Po nanesení se pleť podle popisu výrobce cítí vyživená a pružná.",
      faq: [{ q: "Hodí se krém pro citlivou pleť?", a: "Celá řada Cica Malacalming je určená pro citlivou pleť, tento krém je navíc vhodný pro suchou pleť. Při první aplikaci doporučujeme krém vyzkoušet na malé ploše." }],
    },
    sk: {
      forWhom: "Pre suchú pleť, ktorá potrebuje hydratáciu a pocit vyživenia. Rad Cica Malacalming od Polatam mieri na citlivú, ľahko podráždenú pleť.",
      ingredients: [
        { name: "Centella asijská", text: "Základ receptúry radu, tradične používaná na zklidnenie pleti." },
        { name: "Kyselina hyalurónová", text: "Pomáha viazať vlhkosť, takže pleť zostáva hydratovaná." },
        { name: "Ceramid NP, bambucké maslo a skvalán", text: "Vyživujú pleť a pomáhajú udržať jej ochrannú bariéru." },
      ],
      expect: "Po nanesení sa pleť podľa popisu výrobcu cíti vyživená a pružná.",
      faq: [{ q: "Hodí sa krém pre citlivú pleť?", a: "Celý rad Cica Malacalming je určený pre citlivú pleť, tento krém je navyše vhodný pre suchú pleť. Pri prvej aplikácii odporúčame krém vyskúšať na malej ploche." }],
    },
  },
  {
    code: "GVS-3005205",
    kind: "cream",
    cs: {
      forWhom: "Pro citlivou pleť, která potřebuje zklidnit a hydratovat. Sheabutter a skvalan dodají komfort i pleti, která se rychle stahuje.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňují pleť a dodávají jí komfort." },
        { name: "Kyselina hyaluronová v několika formách", text: "Hydratuje v různých vrstvách pleti." },
        { name: "Ceramid NP, sheabutter, skvalan", text: "Vyživují pleť a podporují její bariéru." },
      ],
      expect: "Pleť podle výrobce působí svěže a zářivě a je příjemně hydratovaná.",
      faq: [{ q: "Je krém vhodný pro citlivou pleť?", a: "Ano, krém je určený pro citlivou pleť. Pokud ji máte velmi reaktivní, vyzkoušejte jej nejdřív na malé ploše." }],
    },
    sk: {
      forWhom: "Pre citlivú pleť, ktorá potrebuje zklidniť a hydratovať. Bambucké maslo a skvalán dodajú komfort aj pleti, ktorá sa rýchlo sťahuje.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňujú pleť a dodávajú jej komfort." },
        { name: "Kyselina hyalurónová vo viacerých formách", text: "Hydratuje v rôznych vrstvách pleti." },
        { name: "Ceramid NP, bambucké maslo, skvalán", text: "Vyživujú pleť a podporujú jej bariéru." },
      ],
      expect: "Pleť podľa výrobcu pôsobí sviežo a žiarivo a je príjemne hydratovaná.",
      faq: [{ q: "Je krém vhodný pre citlivú pleť?", a: "Áno, krém je určený pre citlivú pleť. Ak ju máte veľmi reaktívnu, vyskúšajte ho najprv na malej ploche." }],
    },
  },
  {
    code: "GVS-3005106",
    kind: "serum",
    cs: {
      forWhom: "Pro citlivou pleť, která ocení intenzivní hydrataci a zklidnění v jednom kroku.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňují a pomáhají podrážděné pleti." },
        { name: "Rostlinné extrakty", text: "Brokolice, pupalka, borovice, bambus, zimolez a oliva doplňují zklidňující péči." },
        { name: "Panthenol a glycerin", text: "Udržují vlhkost a dodávají pleti komfort." },
      ],
      expect: "Pleť zůstává podle výrobce vyživená a příjemně hydratovaná.",
      howToUse: ["Po čištění a toniku vklepejte malé množství séra do čisté pleti.", "Pokračujte krémem, ráno přidejte opalovací krém."],
    },
    sk: {
      forWhom: "Pre citlivú pleť, ktorá ocení intenzívnu hydratáciu a zklidnenie v jednom kroku.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňujú a pomáhajú podráždenej pleti." },
        { name: "Rastlinné extrakty", text: "Brokolica, pupalka, borovica, bambus, zemolez a oliva dopĺňajú zklidňujúcu starostlivosť." },
        { name: "Panthenol a glycerín", text: "Udržiavajú vlhkosť a dodávajú pleti komfort." },
      ],
      expect: "Pleť zostáva podľa výrobcu vyživená a príjemne hydratovaná.",
      howToUse: ["Po čistení a toniku vklepkajte malé množstvo séra do čistej pleti.", "Pokračujte krémom, ráno pridajte opaľovací krém."],
    },
  },
  {
    code: "GVS-3005922",
    kind: "pad",
    cs: {
      forWhom: "Pro citlivou pleť, která potřebuje něco navíc: polštářky se chovají jako ampulová péče a lze je přiložit na vybrané partie.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňují a hydratují." },
        { name: "Rostlinné extrakty", text: "Borovice, pupalka, papája, vinná réva a brokolice v koncentrované esenci." },
        { name: "Kyselina hyaluronová v několika formách", text: "Hydratace v různých vrstvách pleti." },
      ],
      expect: "Zklidňující a hydratační efekt podle výrobce; pleť působí svěže po jediném použití.",
      howToUse: ["Na suchou a čistou pleť přiložte polštářek na požadované místo.", "Nechte několik minut působit.", "Zbylou esenci jemně vklepejte do pleti."],
    },
    sk: {
      forWhom: "Pre citlivú pleť, ktorá potrebuje niečo navyše: vankúšiky pôsobia ako ampulová starostlivosť a dajú sa priložiť na vybrané partie.",
      ingredients: [
        { name: "Centella asijská a extrakt z malachitu", text: "Zklidňujú a hydratujú." },
        { name: "Rastlinné extrakty", text: "Borovica, pupalka, papája, vínna réva a brokolica v koncentrovanej esencii." },
        { name: "Kyselina hyalurónová vo viacerých formách", text: "Hydratácia v rôznych vrstvách pleti." },
      ],
      expect: "Zklidňujúci a hydratačný efekt podľa výrobcu; pleť pôsobí sviežo už po jednom použití.",
      howToUse: ["Na suchú a čistú pleť priložte vankúšik na požadované miesto.", "Nechajte niekoľko minút pôsobiť.", "Zvyšnú esenciu jemne vklepkajte do pleti."],
    },
  },

  // ───────────────────────────── VVBETTER
  {
    code: "GVS-2554853",
    kind: "cream",
    cs: {
      forWhom: "Pro pleť, která potřebuje hydrataci i pevnost. Lehká textura se hodí i pro citlivou pleť a funguje jako samostatná denní péče.",
      ingredients: [
        { name: "Centella asijská (53 %)", text: "Vysoký podíl extraktu pleť zklidňuje." },
        { name: "Komplex TECA", text: "Kyselina asiatová, asiatikosid a madekasová kyselina podporují regeneraci pleti." },
        { name: "9 peptidů, adenosin a niacinamid", text: "Pro pevnější a vyrovnanější vzhled pleti." },
        { name: "Kyselina hyaluronová", text: "Dodává vlhkost." },
      ],
      expect: "Pleť je podle výrobce hydratovaná, zklidněná a pevnější na pohled.",
      faq: [{ q: "Hodí se krém pod make-up?", a: "Krém má lehkou texturu a funguje jako samostatná denní péče. Pod make-up jej naneste jako poslední krok péče a nechte vstřebat." }],
    },
    sk: {
      forWhom: "Pre pleť, ktorá potrebuje hydratáciu aj pevnosť. Ľahká textúra sa hodí aj pre citlivú pleť a funguje ako samostatná denná starostlivosť.",
      ingredients: [
        { name: "Centella asijská (53 %)", text: "Vysoký podiel extraktu pleť zklidňuje." },
        { name: "Komplex TECA", text: "Kyselina asiatová, asiatikozid a madekasová kyselina podporujú regeneráciu pleti." },
        { name: "9 peptidov, adenozín a niacínamid", text: "Pre pevnejší a vyrovnanejší vzhľad pleti." },
        { name: "Kyselina hyalurónová", text: "Dodáva vlhkosť." },
      ],
      expect: "Pleť je podľa výrobcu hydratovaná, zklidnená a pevnejšia na pohľad.",
      faq: [{ q: "Hodí sa krém pod make-up?", a: "Krém má ľahkú textúru a funguje ako samostatná denná starostlivosť. Pod make-up ho naneste ako posledný krok starostlivosti a nechajte vstrebať." }],
    },
  },
  {
    code: "GVS-2554846",
    kind: "serum",
    cs: {
      forWhom: "Pro pleť, která potřebuje hydrataci, pevnost a svěží vzhled. Dobře se doplňuje s krémem ze stejné řady Teca Lifting.",
      ingredients: [
        { name: "Centella asijská", text: "Zklidňuje pleť." },
        { name: "Kyselina hyaluronová", text: "Pomáhá udržet vlhkost." },
        { name: "Adenosin a niacinamid", text: "Vyrovnávají vzhled tónu pleti." },
        { name: "8 peptidů", text: "Podporují pevnost pleti." },
      ],
      expect: "Pleť podle výrobce působí hydratovaně, klidněji a pevněji.",
      howToUse: ["Po čištění a toniku naneste sérum pipetou na obličej a krk (pipeta je již v lahvičce).", "Jemně vklepejte do vstřebání.", "Pokračujte krémem, ráno přidejte opalovací krém."],
    },
    sk: {
      forWhom: "Pre pleť, ktorá potrebuje hydratáciu, pevnosť a svieži vzhľad. Dobre sa dopĺňa s krémom z rovnakej série Teca Lifting.",
      ingredients: [
        { name: "Centella asijská", text: "Zklidňuje pleť." },
        { name: "Kyselina hyalurónová", text: "Pomáha udržať vlhkosť." },
        { name: "Adenozín a niacínamid", text: "Vyrovnávajú vzhľad tónu pleti." },
        { name: "8 peptidov", text: "Podporujú pevnosť pleti." },
      ],
      expect: "Pleť podľa výrobcu pôsobí hydratovane, pokojnejšie a pevnejšie.",
      howToUse: ["Po čistení a toniku naneste sérum pipetou na tvár a krk (pipeta je už vo fľaštičke).", "Jemne vklepkajte do vstrebania.", "Pokračujte krémom, ráno pridajte opaľovací krém."],
    },
  },
  {
    code: "GVS-2559933",
    kind: "eye",
    cs: {
      forWhom: "Pro oční okolí s tmavými kruhy, jemnými vráskami a ztrátou pevnosti.",
      ingredients: [
        { name: "Vitamin C", text: "Pomáhá zesvětlit tmavé kruhy a nerovnoměrný tón." },
        { name: "Bakuchiol", text: "Přírodní alternativa retinolu, cílí na jemné vrásky a pevnost." },
        { name: "Skvalan", text: "Pomáhá držet vlhkost v pleti." },
      ],
      expect: "Oční okolí podle výrobce působí hydratovaněji a pevněji; výsledky na tmavých kruzích vyžadují pravidelné používání.",
      howToUse: ["Otočte pumpičkou a stlačte, odeberte malé množství.", "Naneste na čistou pleť v okolí očí a jemně vklepejte špičkou prstu.", "Nenanášejte přímo do očí."],
    },
    sk: {
      forWhom: "Pre očné okolie s tmavými kruhmi, jemnými vráskami a stratou pevnosti.",
      ingredients: [
        { name: "Vitamín C", text: "Pomáha zosvetliť tmavé kruhy a nerovnomerný tón." },
        { name: "Bakuchiol", text: "Prírodná alternatíva retinolu, cieli na jemné vrásky a pevnosť." },
        { name: "Skvalán", text: "Pomáha udržať vlhkosť v pleti." },
      ],
      expect: "Očné okolie podľa výrobcu pôsobí hydratovanejšie a pevnejšie; výsledky na tmavých kruhoch vyžadujú pravidelné používanie.",
      howToUse: ["Otočte pumpičkou a stlačte, odoberte malé množstvo.", "Naneste na čistú pleť v okolí očí a jemne vklepkajte špičkou prsta.", "Nenanášajte priamo do očí."],
    },
  },
  {
    code: "GVS-3012017",
    kind: "toner-acid",
    cs: {
      forWhom: "Pro pleť s matným vzhledem a nerovnou strukturou, která potřebuje jemný peeling. Neutrální pH 5,5 pomáhá nedráždit ani citlivou pleť.",
      ingredients: [
        { name: "AHA kyseliny (glykolová a mléčná)", text: "Jemně odstraňují odumřelé buňky a nečistoty a dodávají pleti zdravý lesk." },
        { name: "Kyselina hyaluronová, betain a glycerin", text: "Pleť hydratují." },
        { name: "Centella asijská", text: "Zklidňuje." },
      ],
      expect: "Hladší struktura a svěžejší vzhled pleti; efekt exfoliace se projeví při pravidelném používání.",
      howToUse: ["Po čištění naneste na vatový polštářek a přetřete obličej, vyhněte se očnímu okolí.", "Začněte 2–3× týdně, večer; pokud pleť snáší, můžete používat častěji.", "Ráno vždy použijte opalovací krém."],
      faq: [{ q: "Mohu tonikum používat denně?", a: "Začněte 2–3× týdně a reakci pleti sledujte. Pokud ji tonikum dráždí, používejte ho méně často. Kombinaci s retinolem nebo dalšími kyselinami nezačínejte najednou." }],
    },
    sk: {
      forWhom: "Pre pleť s matným vzhľadom a nerovnou štruktúrou, ktorá potrebuje jemný peeling. Neutrálne pH 5,5 pomáha nedráždiť ani citlivú pleť.",
      ingredients: [
        { name: "AHA kyseliny (glykolová a mliečna)", text: "Jemne odstraňujú odumreté bunky a nečistoty a dodávajú pleti zdravý lesk." },
        { name: "Kyselina hyalurónová, betaín a glycerín", text: "Pleť hydratujú." },
        { name: "Centella asijská", text: "Zklidňuje." },
      ],
      expect: "Hladšia štruktúra a svieži vzhľad pleti; efekt exfoliácie sa prejaví pri pravidelnom používaní.",
      howToUse: ["Po čistení naneste na vatový tampón a prejdite tvár, vyhnite sa očnému okoliu.", "Začnite 2–3× týždenne, večer; ak pleť znáša, môžete používať častejšie.", "Ráno vždy použite opaľovací krém."],
      faq: [{ q: "Môžem tonikum používať denne?", a: "Začnite 2–3× týždenne a reakciu pleti sledujte. Ak ju tonikum dráždi, používajte ho menej často. Kombináciu s retinolom alebo ďalšími kyselinami nezačínajte naraz." }],
    },
  },
  {
    code: "GVS-6555893",
    kind: "serum",
    cs: {
      forWhom: "Pro pleť náchylnou k nedokonalostem a lesku, která potřebuje zklidnit a vyvážit.",
      ingredients: [
        { name: "Bambusová voda (60 %)", text: "Zklidňuje pleť." },
        { name: "Kyselina jantarová (40 000 ppm)", text: "Pomáhá zmírnit zarudnutí a zlepšit texturu pleti." },
        { name: "Niacinamid", text: "Vyrovnává tón a pomáhá s nedokonalostmi." },
      ],
      expect: "Pleť podle výrobce působí vyváženěji, méně lesklá a klidnější.",
      howToUse: ["Po čištění a toniku naneste malé množství na obličej a jemně vklepejte.", "Doporučené pořadí podle výrobce: zklidňující sérum, sérum s vitaminem C, sérum s bakuchiolem, opalovací krém."],
    },
    sk: {
      forWhom: "Pre pleť náchylnú na nedokonalosti a lesk, ktorá potrebuje zklidniť a vyvážiť.",
      ingredients: [
        { name: "Bambusová voda (60 %)", text: "Zklidňuje pleť." },
        { name: "Kyselina jantárová (40 000 ppm)", text: "Pomáha zmierniť začervenanie a zlepšiť textúru pleti." },
        { name: "Niacínamid", text: "Vyrovnáva tón a pomáha s nedokonalosťami." },
      ],
      expect: "Pleť podľa výrobcu pôsobí vyváženejšie, menej lesklá a pokojnejšia.",
      howToUse: ["Po čistení a toniku naneste malé množstvo na tvár a jemne vklepkajte.", "Odporúčané poradie podľa výrobcu: zklidňujúce sérum, sérum s vitamínom C, sérum s bakuchiolom, opaľovací krém."],
    },
  },
  {
    code: "GVS-7118671",
    kind: "pad",
    cs: {
      forWhom: "Pro mastnou pleť, která potřebuje jemnou exfoliaci a hydrataci v jednom kroku.",
      ingredients: [
        { name: "Extrakt z korejského citrusu yuja", text: "Zdroj vitaminu C, ve vysokém podílu." },
        { name: "PHA (glukonolakton)", text: "Jemně odstraňuje odumřelé buňky bez podráždění." },
        { name: "Zinek PCA", text: "Pomáhá regulovat přebytečný maz." },
        { name: "Komplex MOISTURE B", text: "Hydratuje." },
      ],
      expect: "Pleť podle výrobce působí hladší a čistší bez pocitu staženosti; produkt má vegan certifikaci korejského institutu.",
      howToUse: ["Po očištění pleti přetřete obličej polštářkem, vyhněte se očím.", "Navažte sérem a krémem."],
    },
    sk: {
      forWhom: "Pre mastnú pleť, ktorá potrebuje jemnú exfoliáciu a hydratáciu v jednom kroku.",
      ingredients: [
        { name: "Extrakt z kórejského citrusu yuja", text: "Zdroj vitamínu C, vo vysokom podiele." },
        { name: "PHA (glukonolaktón)", text: "Jemne odstraňuje odumreté bunky bez podráždenia." },
        { name: "Zinok PCA", text: "Pomáha regulovať prebytočný maz." },
        { name: "Komplex MOISTURE B", text: "Hydratuje." },
      ],
      expect: "Pleť podľa výrobcu pôsobí hladšie a čistejšie bez pocitu stiahnutosti; produkt má vegan certifikáciu kórejského inštitútu.",
      howToUse: ["Po očistení pleti prejdite tvár vankúšikom, vyhnite sa očiam.", "Nadviažte sérom a krémom."],
    },
  },
  {
    code: "GVS-7119180",
    kind: "cream",
    cs: {
      forWhom: "Pro pleť s tendencí k lesku a nerovnováze, která potřebuje lehkou hydrataci a obnovu bariéry.",
      ingredients: [
        { name: "Ceramidové mikrokapsle", text: "Pro dlouhodobou hydrataci a obnovu bariéry pleti." },
        { name: "Komplex MOISTURE B (0,5 %)", text: "Rychle zklidňuje citlivou pleť." },
        { name: "Yuzu a zinek PCA", text: "Pomáhají vyvážit pleť s tendencí k lesku." },
        { name: "Centella a houttuynie", text: "Zklidňující extrakty podporují pleť." },
      ],
      expect: "Lehká gelová textura, pleť zůstává podle výrobce hydratovaná a vyvážená.",
    },
    sk: {
      forWhom: "Pre pleť s tendenciou k lesku a nerovnováhe, ktorá potrebuje ľahkú hydratáciu a obnovu bariéry.",
      ingredients: [
        { name: "Ceramidové mikrokapsuly", text: "Pre dlhodobú hydratáciu a obnovu bariéry pleti." },
        { name: "Komplex MOISTURE B (0,5 %)", text: "Rýchlo zklidňuje citlivú pleť." },
        { name: "Yuzu a zinok PCA", text: "Pomáhajú vyvážiť pleť s tendenciou k lesku." },
        { name: "Centella a houttuynia", text: "Zklidňujúce extrakty podporujú pleť." },
      ],
      expect: "Ľahká gélová textúra, pleť zostáva podľa výrobcu hydratovaná a vyvážená.",
    },
  },

  // ───────────────────────────── Dr. Althea
  {
    code: "GVS-251745",
    kind: "cream",
    cs: {
      forWhom: "Pro unavenou pleť, která potřebuje pevnost a hydrataci. Bohatá textura se hodí na večer.",
      ingredients: [
        { name: "Protěž alpská (edelweiss)", text: "Přírodní antioxidant, pomáhá pleti s elasticitou a vzhledem vrásek." },
        { name: "Hydratační složky", text: "Pleť zůstává vlhká a mírně zářivá." },
      ],
      expect: "Pleť působí podle výrobce pevněji, hydratovaněji a mírně zářivě.",
    },
    sk: {
      forWhom: "Pre unavenú pleť, ktorá potrebuje pevnosť a hydratáciu. Bohatá textúra sa hodí na večer.",
      ingredients: [
        { name: "Plesnivec alpínsky (edelweiss)", text: "Prírodný antioxidant, pomáha pleti s elasticitou a vzhľadom vrások." },
        { name: "Hydratačné zložky", text: "Pleť zostáva vlhká a mierne žiarivá." },
      ],
      expect: "Pleť pôsobí podľa výrobcu pevnejšie, hydratovanejšie a mierne žiarivo.",
    },
  },
  {
    code: "GVS-251981",
    kind: "sheet",
    cs: {
      forWhom: "Pro pleť se zarudnutím a nedokonalostmi, která potřebuje zklidnit a hydratovat.",
      ingredients: [
        { name: "Mořské rostlinné extrakty", text: "Tonizují, hydratují a zklidňují pleť." },
        { name: "Laktobacily", text: "Podporují rovnováhu mikrobiomu pleti." },
      ],
      expect: "Zmírnění zarudnutí a lepší struktura a pružnost pleti včetně rozšířených pórů (tvrzení výrobce).",
    },
    sk: {
      forWhom: "Pre pleť so začervenaním a nedokonalosťami, ktorá potrebuje zklidniť a hydratovať.",
      ingredients: [
        { name: "Morské rastlinné extrakty", text: "Tonizujú, hydratujú a zklidňujú pleť." },
        { name: "Laktobacily", text: "Podporujú rovnováhu mikrobiómu pleti." },
      ],
      expect: "Zmiernenie začervenania a lepšia štruktúra a pružnosť pleti vrátane rozšírených pórov (tvrdenie výrobcu).",
    },
  },
  {
    code: "GVS-255033",
    kind: "spot",
    cs: {
      forWhom: "Pro lokální péči o problematická místa, ne pro celý obličej.",
      ingredients: [
        { name: "Kalamin (15 %)", text: "Vysoce čistý kalamin zklidňuje podrážděná místa." },
        { name: "Extrakt ze zeleného čaje", text: "Zklidňuje pleť." },
        { name: "Kyselina salicylová", text: "Zjemňuje strukturu pleti a reguluje přebytečný maz." },
        { name: "Liposomální ceramid", text: "Podporuje hydrataci a ochrannou bariéru." },
      ],
      expect: "Zklidnění vybraných míst přes noc; ráno místo opláchněte.",
      howToUse: ["Lahvičku před použitím netřepejte.", "Kapku naneste přímo na problematické místo a nechte působit přes noc.", "Ráno místo opláchněte."],
      faq: [{ q: "Mohu přípravek nanést na celý obličej?", a: "Ne, je určený k cílené péči o jednotlivá místa. Nepoužívejte jej na poškozenou pokožku." }],
    },
    sk: {
      forWhom: "Pre lokálnu starostlivosť o problematické miesta, nie pre celú tvár.",
      ingredients: [
        { name: "Kalamín (15 %)", text: "Vysoko čistý kalamín zklidňuje podráždené miesta." },
        { name: "Extrakt zo zeleného čaju", text: "Zklidňuje pleť." },
        { name: "Kyselina salicylová", text: "Zjemňuje štruktúru pleti a reguluje prebytočný maz." },
        { name: "Lipozomálny ceramid", text: "Podporuje hydratáciu a ochrannú bariéru." },
      ],
      expect: "Zklidnenie vybraných miest cez noc; ráno miesto opláchnite.",
      howToUse: ["Fľaštičku pred použitím nepretrepávajte.", "Kvapku naneste priamo na problematické miesto a nechajte pôsobiť cez noc.", "Ráno miesto opláchnite."],
      faq: [{ q: "Môžem prípravok naniesť na celú tvár?", a: "Nie, je určený na cielenú starostlivosť o jednotlivé miesta. Nepoužívajte ho na poškodenú pokožku." }],
    },
  },
  {
    code: "GVS-255071",
    kind: "balm",
    cs: {
      forWhom: "Pro citlivou pleť, která potřebuje jemné odličování včetně opalovacího krému a voděodolného make-upu.",
      ingredients: [
        { name: "14 přírodních složek", text: "Krátké složení pro šetrné čištění." },
        { name: "Olej z kamélie a z hroznových jader", text: "Rozpouští make-up a nečistoty, pleť zůstává měkká." },
        { name: "Madecassosid a centella", text: "Zklidňují pleť při čištění." },
      ],
      expect: "Pleť je po odličování měkká a nevysušená.",
      faq: [{ q: "Odstraní balzám i voděodolný make-up?", a: "Ano, balzám snadno odstraňuje opalovací krém, make-up i voděodolné produkty. Pro dvojí čištění navažte jemnou pěnou nebo gelem." }],
    },
    sk: {
      forWhom: "Pre citlivú pleť, ktorá potrebuje jemné odličovanie vrátane opaľovacieho krému a vodeodolného make-upu.",
      ingredients: [
        { name: "14 prírodných zložiek", text: "Krátke zloženie pre šetrné čistenie." },
        { name: "Olej z kamélie a z hroznových jadier", text: "Rozpúšťa make-up a nečistoty, pleť zostáva mäkká." },
        { name: "Madecassosid a centella", text: "Zklidňujú pleť pri čistení." },
      ],
      expect: "Pleť je po odličovaní mäkká a nevysušená.",
      faq: [{ q: "Odstráni balzam aj vodeodolný make-up?", a: "Áno, balzam ľahko odstraňuje opaľovací krém, make-up aj vodeodolné produkty. Pre dvojité čistenie nadviažte jemnou penou alebo gélom." }],
    },
  },
  {
    code: "GVS-255385",
    kind: "serum",
    cs: {
      forWhom: "Pro pleť s pigmentovými skvrnami, stopami po akné a nevyrovnaným tónem; hodí se i těm, kterým připadají klasická rozjasňující séra příliš agresivní.",
      ingredients: [
        { name: "Voda z rakytníku (63 %)", text: "Základ séra, doplněný o další rozjasňující složky." },
        { name: "Niacinamid (5 %) a kyselina tranexamová (2 %)", text: "Pomáhají vyrovnat tón a viditelně zesvětlit skvrny." },
        { name: "Vitamin C a alfa-arbutin", text: "Doplňují rozjasňující péči." },
      ],
      expect: "Při pravidelném používání působí pleť podle výrobce jasněji a vyrovnaněji; skvrny a stopy po akné se postupně zesvětlují.",
      howToUse: ["Po čištění a toniku nechte pleť zcela oschnout.", "Naneste několik kapek rovnoměrně na obličej a jemně vklepejte do vstřebání.", "Pokračujte krémem. Pokud sérum používáte ráno, vždy ukončete opalovacím krémem.", "Pokud jste s vitaminem C noví, začněte obden a frekvenci zvyšujte podle komfortu pleti."],
    },
    sk: {
      forWhom: "Pre pleť s pigmentovými škvrnami, stopami po akné a nevyrovnaným tónom; hodí sa aj tým, ktorým pripadajú klasické rozjasňujúce séra príliš agresívne.",
      ingredients: [
        { name: "Voda z rakytníka (63 %)", text: "Základ séra, doplnený o ďalšie rozjasňujúce zložky." },
        { name: "Niacínamid (5 %) a kyselina tranexámová (2 %)", text: "Pomáhajú vyrovnať tón a viditeľne zosvetliť škvrny." },
        { name: "Vitamín C a alfa-arbutín", text: "Dopĺňajú rozjasňujúcu starostlivosť." },
      ],
      expect: "Pri pravidelnom používaní pôsobí pleť podľa výrobcu jasnejšie a vyrovnanejšie; škvrny a stopy po akné sa postupne zosvetľujú.",
      howToUse: ["Po čistení a toniku nechajte pleť úplne oschnúť.", "Naneste niekoľko kvapiek rovnomerne na tvár a jemne vklepkajte do vstrebania.", "Pokračujte krémom. Ak sérum používate ráno, vždy ukončite opaľovacím krémom.", "Ak ste s vitamínom C noví, začnite obden a frekvenciu zvyšujte podľa komfortu pleti."],
    },
  },
  {
    code: "GVS-255620",
    kind: "balm",
    cs: {
      forWhom: "Pro všechny typy pleti, zvlášť pro pleť s ucpanými póry a přebytečným mazem.",
      ingredients: [
        { name: "Extrakt ze zeleného čaje", text: "Pomáhá regulovat přebytečný maz." },
        { name: "Guaiazulen", text: "Zklidňuje pleť při čištění." },
      ],
      expect: "Hloubkově, ale jemně vyčištěné póry a hebká, hydratovaná pleť.",
      howToUse: ["Zabudovaný mechanismus balení balzám promíchá a rozpustí.", "Naneste na suchou pleť a jemně vmasírujte; přidejte trochu vody.", "Důkladně opláchněte."],
    },
    sk: {
      forWhom: "Pre všetky typy pleti, najmä pre pleť s upchatými pórmi a prebytočným mazom.",
      ingredients: [
        { name: "Extrakt zo zeleného čaju", text: "Pomáha regulovať prebytočný maz." },
        { name: "Guaiazulén", text: "Zklidňuje pleť pri čistení." },
      ],
      expect: "Hĺbkovo, ale jemne vyčistené póry a hebká, hydratovaná pleť.",
      howToUse: ["Zabudovaný mechanizmus balenia balzam premieša a rozpustí.", "Naneste na suchú pleť a jemne vmasírujte; pridajte trochu vody.", "Dôkladne opláchnite."],
    },
  },
  {
    code: "GVS-255712",
    kind: "sheet",
    cs: {
      forWhom: "Pro citlivou a podrážděnou pleť se zarudnutím; chladivý efekt zklidní i po slunci nebo náročném dni.",
      ingredients: [
        { name: "Komplex Cica", text: "Zklidňuje podrážděnou pleť." },
        { name: "Extrakt z heřmánku a březová voda", text: "Hluboce hydratují a posilují bariéru." },
        { name: "Studený kamenný prášek", text: "Podle výrobce zvyšuje chladivý efekt o 30 %." },
      ],
      expect: "Zklidnění a snížení zarudnutí, chladivý pocit po aplikaci.",
    },
    sk: {
      forWhom: "Pre citlivú a podráždenú pleť so začervenaním; chladivý efekt zklidní aj po slnku alebo náročnom dni.",
      ingredients: [
        { name: "Komplex Cica", text: "Zklidňuje podráždenú pleť." },
        { name: "Extrakt z harmančeka a brezová voda", text: "Hlboko hydratujú a posilňujú bariéru." },
        { name: "Studený kamenný prášok", text: "Podľa výrobcu zvyšuje chladivý efekt o 30 %." },
      ],
      expect: "Zklidnenie a zníženie začervenania, chladivý pocit po aplikácii.",
    },
  },
  {
    code: "GVS-255736",
    kind: "sheet",
    cs: {
      forWhom: "Pro citlivou a smíšenou pleť, která potřebuje obnovit hydrataci a lipidovou rovnováhu.",
      ingredients: [
        { name: "10 typů kyseliny hyaluronové", text: "Hydratace v různých vrstvách pleti." },
        { name: "Rostlinná PDRN z listů lotosu", text: "Rostlinná alternativa, pomáhá pleť regenerovat." },
        { name: "Panthenol s madecassosidem", text: "Zklidňují a podporují bariéru." },
      ],
      expect: "Vláčný, svěží vzhled pleti po aplikaci.",
      howToUse: ["Na čistou pleť naneste dvouvrstvou gelovou masku podle návodu na obalu.", "Nechte působit doporučenou dobu.", "Zbytek produktu jemně vklepejte do pleti."],
    },
    sk: {
      forWhom: "Pre citlivú a zmiešanú pleť, ktorá potrebuje obnoviť hydratáciu a lipidovú rovnováhu.",
      ingredients: [
        { name: "10 typov kyseliny hyalurónovej", text: "Hydratácia v rôznych vrstvách pleti." },
        { name: "Rastlinná PDRN z listov lotosu", text: "Rastlinná alternatíva, pomáha pleť regenerovať." },
        { name: "Panthenol s madecassosidom", text: "Zklidňujú a podporujú bariéru." },
      ],
      expect: "Vláčny, svieži vzhľad pleti po aplikácii.",
      howToUse: ["Na čistú pleť naneste dvojvrstvovú gélovú masku podľa návodu na obale.", "Nechajte pôsobiť odporúčanú dobu.", "Zvyšok produktu jemne vklepkajte do pleti."],
    },
  },
  {
    code: "GVS-255972",
    kind: "sun",
    cs: {
      forWhom: "Pro suchou a nevyváženou pleť, která chce denní ochranu bez lepivého a mastného pocitu.",
      ingredients: [
        { name: "SPF50+ PA++++", text: "Ochrana před UVB i UVA zářením." },
        { name: "Panthenol", text: "Pomáhá hydratovat a podporuje bariéru." },
        { name: "Extrakt z mořské řasy Caulerpa lentillifera", text: "Doplňuje hydrataci." },
      ],
      expect: "Lehká vodnatá textura s vlhkým „aqua glow“ finišem, nelepí a nemastí.",
    },
    sk: {
      forWhom: "Pre suchú a nevyváženú pleť, ktorá chce dennú ochranu bez lepivého a mastného pocitu.",
      ingredients: [
        { name: "SPF50+ PA++++", text: "Ochrana pred UVB aj UVA žiarením." },
        { name: "Panthenol", text: "Pomáha hydratovať a podporuje bariéru." },
        { name: "Extrakt z morskej riasy Caulerpa lentillifera", text: "Dopĺňa hydratáciu." },
      ],
      expect: "Ľahká vodnatá textúra s vlhkým „aqua glow“ finišom, nelepí a nemastí.",
    },
  },
  {
    code: "GVS-256184",
    kind: "mist",
    cs: {
      forWhom: "Pro citlivou i normální pleť, která chce rychlou svěžest a hydrataci během dne nebo mezi kroky rutiny.",
      ingredients: [
        { name: "Hlubinná mořská voda (10 %)", text: "Z korejského ostrova Ulleungdo, dodává pleti minerály a vlhkost." },
        { name: "Veganská PDRN", text: "Doplňuje regenerační péči." },
        { name: "Extrakt z malachitu", text: "Dává mlze přirozeně modrou barvu a zklidňuje." },
      ],
      expect: "Ultrajemná mlha dává pleti svěží „jelly“ lesk a pocit hydratace; je šetrná k citlivé pleti.",
      faq: [{ q: "Mohu mlhu použít přes make-up?", a: "Mlha je lehká, hodí se pro osvěžení během dne. Pokud ji používáte přes make-up, stříkejte ze vzdálenosti a nechte zaschnout." }],
    },
    sk: {
      forWhom: "Pre citlivú aj normálnu pleť, ktorá chce rýchlu sviežosť a hydratáciu počas dňa alebo medzi krokmi rutiny.",
      ingredients: [
        { name: "Hlbinná morská voda (10 %)", text: "Z kórejského ostrova Ulleungdo, dodáva pleti minerály a vlhkosť." },
        { name: "Vegánska PDRN", text: "Dopĺňa regeneračnú starostlivosť." },
        { name: "Extrakt z malachitu", text: "Dáva hmle prirodzene modrú farbu a zklidňuje." },
      ],
      expect: "Ultrajemná hmla dáva pleti svieži „jelly“ lesk a pocit hydratácie; je šetrná k citlivej pleti.",
      faq: [{ q: "Môžem hmlu použiť cez make-up?", a: "Hmla je ľahká, hodí sa na osvieženie počas dňa. Ak ju používate cez make-up, striekajte z diaľky a nechajte zaschnúť." }],
    },
  },
  {
    code: "GVS-256191",
    kind: "serum",
    cs: {
      forWhom: "Pro všechny typy pleti, včetně mastné a smíšené: lehké sérum se rychle vstřebává a nelepí.",
      ingredients: [
        { name: "Voda z bambusu (70 %)", text: "Základ séra, hydratuje a zklidňuje." },
        { name: "3D kyselina hyaluronová", text: "Patentovaná technologie pro dlouhodobou hydrataci a podporu bariéry." },
      ],
      expect: "Pleť zůstává svěže vlhká a jemně zářivá.",
    },
    sk: {
      forWhom: "Pre všetky typy pleti, vrátane mastnej a zmiešanej: ľahké sérum sa rýchlo vstrebáva a nelepí.",
      ingredients: [
        { name: "Voda z bambusu (70 %)", text: "Základ séra, hydratuje a zklidňuje." },
        { name: "3D kyselina hyalurónová", text: "Patentovaná technológia pre dlhodobú hydratáciu a podporu bariéry." },
      ],
      expect: "Pleť zostáva sviežo vlhká a jemne žiarivá.",
    },
  },
  {
    code: "GVS-256221",
    kind: "cream",
    cs: {
      forWhom: "Pro aknózní, citlivou a smíšenou pleť a pleť s následky po akné (zarudnutí, nerovná struktura, skvrny).",
      ingredients: [
        { name: "Niacinamid", text: "Rozjasňuje a pomáhá s viditelnými stopami po akné." },
        { name: "Ceramid NP", text: "Dlouhodobě hydratuje a pomáhá obnovit narušenou bariéru." },
        { name: "Voda z čajovníku australského, centella, madekasosid", text: "Zklidňují pleť náchylnou k nedokonalostem." },
      ],
      expect: "Podle výrobce klinicky testováno jako nekomedogenní a vhodné pro citlivou pleť; pleť zůstává hydratovaná bez těžkého pocitu.",
      howToUse: [
        "Jako denní krém: naneste jako poslední krok péče na obličej a jemně vtlačte do pleti.",
        "Metoda „sendvič“ při používání silných aktivních látek (např. retinoidů): nejdřív tenká vrstva krému, pak aktivní složka, nakonec další vrstva krému.",
      ],
    },
    sk: {
      forWhom: "Pre aknóznu, citlivú a zmiešanú pleť a pleť s následkami po akné (začervenanie, nerovná štruktúra, škvrny).",
      ingredients: [
        { name: "Niacínamid", text: "Rozjasňuje a pomáha s viditeľnými stopami po akné." },
        { name: "Ceramid NP", text: "Dlhodobo hydratuje a pomáha obnoviť narušenú bariéru." },
        { name: "Voda z čajovníka austrálskeho, centella, madekasosid", text: "Zklidňujú pleť náchylnú na nedokonalosti." },
      ],
      expect: "Podľa výrobcu klinicky testované ako nekomedogénne a vhodné pre citlivú pleť; pleť zostáva hydratovaná bez ťažkého pocitu.",
      howToUse: [
        "Ako denný krém: naneste ako posledný krok starostlivosti na tvár a jemne vtlačte do pleti.",
        "Metóda „sendvič“ pri používaní silných aktívnych látok (napr. retinoidov): najprv tenká vrstva krému, potom aktívna zložka, nakoniec ďalšia vrstva krému.",
      ],
    },
  },
  {
    code: "GVS-256412",
    kind: "cream",
    cs: {
      forWhom: "Pro podrážděnou pleť, která potřebuje zklidnit a posílit bariéru; lze použít jako denní péči i „SOS“ ošetření.",
      ingredients: [
        { name: "Veganská PDRN (5 000 ppm)", text: "Z pěti fermentovaných složek, podporuje bariéru a pružnost pleti." },
        { name: "Voda z listů centelly asijské (50 000 ppm)", text: "Zklidňuje podrážděnou pleť." },
      ],
      expect: "Maznavá, ale nemastná textura se dobře vstřebává a dá se vrstvit podle typu pleti.",
    },
    sk: {
      forWhom: "Pre podráždenú pleť, ktorá potrebuje zklidniť a posilniť bariéru; možno použiť ako dennú starostlivosť aj „SOS“ ošetrenie.",
      ingredients: [
        { name: "Vegánska PDRN (5 000 ppm)", text: "Z piatich fermentovaných zložiek, podporuje bariéru a pružnosť pleti." },
        { name: "Voda z listov centelly asijskej (50 000 ppm)", text: "Zklidňuje podráždenú pleť." },
      ],
      expect: "Mazľavá, ale nemastná textúra sa dobre vstrebáva a dá sa vrstviť podľa typu pleti.",
    },
  },
  {
    code: "GVS-256658",
    kind: "eye",
    cs: {
      forWhom: "Pro oční okolí s jemnými vráskami; obsahuje retinol, proto se hodí spíš na večer.",
      ingredients: [
        { name: "Retinol (1 000 ppm) a bakuchiol", text: "Pomáhají vyhlazovat vrásky a podporovat pevnost." },
        { name: "Kyselina hyaluronová", text: "Hydratuje." },
        { name: "5 % Cica Retisome (centella, madekasosid)", text: "Zklidňuje pokožku." },
      ],
      expect: "Zabudovaný masážní váleček gua sha zvýrazňuje liftingový efekt a nedráždí oční okolí.",
      howToUse: ["Naneste na čistou pleť v okolí očí pomocí válečku, jemně masírujte.", "Používejte spíše večer; přes den chraňte pleť krémem s SPF."],
    },
    sk: {
      forWhom: "Pre očné okolie s jemnými vráskami; obsahuje retinol, preto sa hodí skôr na večer.",
      ingredients: [
        { name: "Retinol (1 000 ppm) a bakuchiol", text: "Pomáhajú vyhladzovať vrásky a podporovať pevnosť." },
        { name: "Kyselina hyalurónová", text: "Hydratuje." },
        { name: "5 % Cica Retisome (centella, madekasosid)", text: "Zklidňuje pokožku." },
      ],
      expect: "Zabudovaný masážny valček gua sha zvýrazňuje liftingový efekt a nedráždi očné okolie.",
      howToUse: ["Naneste na čistú pleť v okolí očí pomocou valčeka, jemne masírujte.", "Používajte skôr večer; cez deň chráňte pleť krémom s SPF."],
    },
  },
  {
    code: "GVS-256795",
    kind: "cream",
    cs: {
      forWhom: "Pro suchou, dehydratovanou a citlivou pleť s narušenou bariérou; bohatá textura se hodí zvlášť na noc.",
      ingredients: [
        { name: "Patentovaný extrakt z květů pivoňky", text: "Paeonia Albiflora, vyživuje a posiluje kožní bariéru." },
        { name: "Extrakt z avokáda a arganový olej", text: "Vyživují a změkčují pleť." },
        { name: "Sedmivrstvé složení s kyselinou hyaluronovou", text: "Podporuje pevnost a hydrataci." },
      ],
      expect: "Bohatá, ale příjemná textura; pleť podle výrobce působí vyživeněji a odolněji.",
    },
    sk: {
      forWhom: "Pre suchú, dehydratovanú a citlivú pleť s narušenou bariérou; bohatá textúra sa hodí najmä na noc.",
      ingredients: [
        { name: "Patentovaný extrakt z kvetov pivonky", text: "Paeonia Albiflora, vyživuje a posilňuje kožnú bariéru." },
        { name: "Extrakt z avokáda a arganový olej", text: "Vyživujú a zjemňujú pleť." },
        { name: "Sedemvrstvové zloženie s kyselinou hyalurónovou", text: "Podporuje pevnosť a hydratáciu." },
      ],
      expect: "Bohatá, ale príjemná textúra; pleť podľa výrobcu pôsobí vyživenejšie a odolnejšie.",
    },
  },
  {
    code: "SPV-0247760",
    kind: "foam",
    cs: {
      forWhom: "Pro citlivou i aknózní pleť nebo pleť s narušenou bariérou, která potřebuje jemné čištění bez stahování.",
      ingredients: [
        { name: "Komplex 17 aminokyselin", text: "Odstraňuje nečistoty a zbytky make-upu a pleť nevysušuje." },
        { name: "Kyselina hyaluronová a ceramid NP", text: "Hydratují a podporují bariéru." },
        { name: "Extrakt ze semínek perilly a bambusová voda", text: "Zklidňují pleť." },
      ],
      expect: "Hustá pěna s drobnými bublinkami (kolem 200 nm) se dostane i do pórů. Podle výrobce vegan certifikované, bez parabenů a umělých barviv.",
      howToUse: ["Navlhčete obličej vlažnou vodou.", "Stlačte pumpičku do čistých rukou a pěnu jemně vmasírujte do pleti, vyhněte se očím.", "Důkladně opláchněte vlažnou vodou a osušte."],
    },
    sk: {
      forWhom: "Pre citlivú aj aknóznu pleť alebo pleť s narušenou bariérou, ktorá potrebuje jemné čistenie bez sťahovania.",
      ingredients: [
        { name: "Komplex 17 aminokyselín", text: "Odstraňuje nečistoty a zvyšky make-upu a pleť nevysušuje." },
        { name: "Kyselina hyalurónová a ceramid NP", text: "Hydratujú a podporujú bariéru." },
        { name: "Extrakt zo semienok perily a bambusová voda", text: "Zklidňujú pleť." },
      ],
      expect: "Hustá pena s drobnými bublinkami (okolo 200 nm) sa dostane aj do pórov. Podľa výrobcu vegan certifikované, bez parabénov a umelých farbív.",
      howToUse: ["Navlhčite tvár vlažnou vodou.", "Stlačte pumpičku do čistých rúk a penu jemne vmasírujte do pleti, vyhnite sa očiam.", "Dôkladne opláchnite vlažnou vodou a osušte."],
    },
  },
  {
    code: "SPV-0247761",
    kind: "foam",
    cs: {
      forWhom: "Pro citlivou, suchou i smíšenou pleť nebo pleť s tendencí k akné, která potřebuje šetrné čištění.",
      ingredients: [
        { name: "Mírně kyselé pH 5,0–6,0", text: "Respektuje přirozenou rovnováhu pleti, minimum zbytků po smytí." },
        { name: "Ceramid NP a kyselina hyaluronová", text: "Pleť zůstává po umytí hydratovaná." },
        { name: "Aminokyselinové tenzidy", text: "Jemná pěna s drobnými bublinkami čistí bez agresivního drhnutí." },
      ],
      expect: "Pleť podle výrobce zůstává osvěžená a hydratovaná, bez pocitu staženosti; klinicky testováno na citlivé pleti.",
      howToUse: ["Navlhčete obličej a ruce vlažnou vodou.", "Dávkujte malé množství do dlaní a vytvořte pěnu.", "Jemně masírujte obličej kruhovými pohyby, vyhněte se očím, a důkladně opláchněte."],
    },
    sk: {
      forWhom: "Pre citlivú, suchú aj zmiešanú pleť alebo pleť s tendenciou k akné, ktorá potrebuje šetrné čistenie.",
      ingredients: [
        { name: "Mierne kyslé pH 5,0–6,0", text: "Rešpektuje prirodzenú rovnováhu pleti, minimum zvyškov po zmytí." },
        { name: "Ceramid NP a kyselina hyalurónová", text: "Pleť zostáva po umytí hydratovaná." },
        { name: "Aminokyselinové tenzidy", text: "Jemná pena s drobnými bublinkami čistí bez agresívneho drhnutia." },
      ],
      expect: "Pleť podľa výrobcu zostáva osviežená a hydratovaná, bez pocitu stiahnutosti; klinicky testované na citlivej pleti.",
      howToUse: ["Navlhčite tvár a ruky vlažnou vodou.", "Dávkujte malé množstvo do dlaní a vytvorte penu.", "Jemne masírujte tvár kruhovými pohybmi, vyhnite sa očiam, a dôkladne opláchnite."],
    },
  },
  {
    code: "SPV-0247763",
    kind: "serum",
    cs: {
      forWhom: "Pro začátečníky s retinolem a všechny typy pleti včetně citlivé a pleti náchylné k akné.",
      ingredients: [
        { name: "Retinol", text: "Zlepšuje vzhled vrásek a zmenšuje viditelnost pórů." },
        { name: "Bakuchiol", text: "Rostlinná alternativa retinolu, podporuje pevnost a pružnost." },
        { name: "Šest bylinných extraktů a panthenol", text: "Chrpa, brutnák, levandule, heřmánek, hyacint a šalvěj muškátová zklidňují a hydratují." },
      ],
      expect: "Lehká textura se nemastí; výrobce uvádí zjemnění stop po akné a hladší strukturu pleti.",
      howToUse: ["V prvních dvou týdnech nanášejte 1–2 stlačení pumpičky obden.", "Od třetího týdne 3–4 stlačení denně.", "Přes den používejte krém s UV filtrem."],
    },
    sk: {
      forWhom: "Pre začiatočníkov s retinolom a všetky typy pleti vrátane citlivej a pleti náchylnej na akné.",
      ingredients: [
        { name: "Retinol", text: "Zlepšuje vzhľad vrások a zmenšuje viditeľnosť pórov." },
        { name: "Bakuchiol", text: "Rastlinná alternatíva retinolu, podporuje pevnosť a pružnosť." },
        { name: "Šesť bylinných extraktov a panthenol", text: "Nevädza, borák, levanduľa, harmanček, hyacint a šalvia muškátová zklidňujú a hydratujú." },
      ],
      expect: "Ľahká textúra sa nemastí; výrobca uvádza zjemnenie stôp po akné a hladšiu štruktúru pleti.",
      howToUse: ["V prvých dvoch týždňoch nanášajte 1–2 stlačenia pumpičky obden.", "Od tretieho týždňa 3–4 stlačenia denne.", "Cez deň používajte krém s UV filtrom."],
    },
  },
  {
    code: "SPV-0247764",
    kind: "serum",
    cs: {
      forWhom: "Pro unavenou, zarudlou nebo podrážděnou pleť, která potřebuje hydrataci i zklidnění v jednom séru.",
      ingredients: [
        { name: "6 typů kyseliny hyaluronové", text: "Vyplňují pleť vlhkostí." },
        { name: "Niacinamid a adenosin", text: "Pro vyrovnanější tón a pružnější vzhled." },
        { name: "Noni a centella asijská", text: "Zklidňují zarudlou a unavenou pleť." },
        { name: "Betain", text: "Hydratuje a zlepšuje texturu." },
      ],
      expect: "Podle výrobce pomáhá uvolnit pocit staženosti a podporuje vyváženost vlhkosti a mazu. Jemně zelený odstín dodávají extrakty z lilkovce.",
    },
    sk: {
      forWhom: "Pre unavenú, začervenanú alebo podráždenú pleť, ktorá potrebuje hydratáciu aj zklidnenie v jednom sére.",
      ingredients: [
        { name: "6 typov kyseliny hyalurónovej", text: "Vypĺňajú pleť vlhkosťou." },
        { name: "Niacínamid a adenozín", text: "Pre vyrovnanejší tón a pružnejší vzhľad." },
        { name: "Noni a centella asijská", text: "Zklidňujú začervenanú a unavenú pleť." },
        { name: "Betaín", text: "Hydratuje a zlepšuje textúru." },
      ],
      expect: "Podľa výrobcu pomáha uvoľniť pocit stiahnutosti a podporuje vyváženosť vlhkosti a mazu. Jemne zelený odtieň dodávajú extrakty z lilkovca.",
    },
  },
  {
    code: "SPV-0247765",
    kind: "serum",
    cs: {
      forWhom: "Pro pleť s lesklými partiemi, rozšířenými póry a nerovným tónem. Vyšší koncentrace niacinamidu se hodí pro ty, kdo už mají s aktivními látkami zkušenosti.",
      ingredients: [
        { name: "Niacinamid (15 %)", text: "Pomáhá s vzhledem pórů, lesku a nerovného tónu." },
        { name: "Zinek PCA", text: "Pomáhá regulovat přebytečný maz." },
        { name: "Komplex MELACUT", text: "Šrucha zelná, extrakt z jader hroznů, Saururus chinensis a filtrát z fermentované rýže zklidňují a vyrovnávají tón." },
      ],
      expect: "Podle výrobce méně viditelný lesk, jemnější vzhled pórů a vyrovnanější tón při pravidelném používání. Veganské, cruelty-free, pH 6,1.",
      howToUse: ["Po čištění a toniku naneste malé množství séra na obličej.", "Jemně vklepejte, poté pokračujte krémem.", "Při první aplikaci vyzkoušejte sérum na malé ploše; přes den používejte opalovací krém."],
    },
    sk: {
      forWhom: "Pre pleť s lesklými partiami, rozšírenými pórmi a nerovným tónom. Vyššia koncentrácia niacínamidu sa hodí pre tých, ktorí už skúšali sérá s aktívnymi látkami.",
      ingredients: [
        { name: "Niacínamid (15 %)", text: "Pomáha so vzhľadom pórov, lesku a nerovného tónu." },
        { name: "Zinok PCA", text: "Pomáha regulovať prebytočný maz." },
        { name: "Komplex MELACUT", text: "Portulaka, extrakt z jadier hrozna, Saururus chinensis a filtrát z fermentovanej ryže zklidňujú a vyrovnávajú tón." },
      ],
      expect: "Podľa výrobcu menej viditeľný lesk, jemnejší vzhľad pórov a vyrovnanejší tón pri pravidelnom používaní. Vegánske, cruelty-free, pH 6,1.",
      howToUse: ["Po čistení a toniku naneste malé množstvo séra na tvár.", "Jemne vklepkajte, potom pokračujte krémom.", "Pri prvej aplikácii vyskúšajte sérum na malej ploche; cez deň používajte opaľovací krém."],
    },
  },
  {
    code: "SPV-0247766",
    kind: "essence",
    cs: {
      forWhom: "Pro pleť, která potřebuje hydrataci hned po čištění; vhodné i pro citlivou pleť.",
      ingredients: [
        { name: "Anastatica Hierochuntica (85 %)", text: "Extrakt z růže z Jericha, hluboce hydratuje a chrání před vnějšími vlivy." },
        { name: "Kyselina hyaluronová ve více vrstvách", text: "Rychle doplňuje vlhkost a brání jejímu úniku." },
        { name: "Allantoin", text: "Zklidňuje." },
      ],
      expect: "Veganská formule bez testování na zvířatech a bez umělých barviv; tonikum je prvním krokem hydratační péče.",
      howToUse: ["Po čištění nalijte na vatový tampon nebo do dlaní.", "Jemně vklepejte do pleti.", "Navažte sérem a krémem."],
    },
    sk: {
      forWhom: "Pre pleť, ktorá potrebuje hydratáciu hneď po čistení; vhodné aj pre citlivú pleť.",
      ingredients: [
        { name: "Anastatica Hierochuntica (85 %)", text: "Extrakt z ruže z Jericha, hlboko hydratuje a chráni pred vonkajšími vplyvmi." },
        { name: "Kyselina hyalurónová vo viacerých vrstvách", text: "Rýchlo dopĺňa vlhkosť a bráni jej úniku." },
        { name: "Alantoín", text: "Zklidňuje." },
      ],
      expect: "Vegánska formula bez testovania na zvieratách a bez umelých farbív; tonikum je prvým krokom hydratačnej starostlivosti.",
      howToUse: ["Po čistení naneste na vatový tampón alebo do dlaní.", "Jemne vklepkajte do pleti.", "Nadviažte sérom a krémom."],
    },
  },
];
