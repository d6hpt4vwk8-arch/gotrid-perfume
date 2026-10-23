// Slovak versions of the long legal / informational pages. The Czech originals
// live next to each route (src/app/[locale]/(shop)/<page>/page.tsx); a route
// renders one of these instead when the visitor browses /sk. The seller is a
// Czech company, so the contract is still governed by Czech law — the texts
// below add the Slovak consumer-protection contacts and keep the consumer's
// mandatory rights under Slovak law untouched.
import Image from "next/image";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import type { SellerIdentity } from "@/lib/business-identity";
import { CONTACT } from "@/lib/business-identity";
import { PICKUP_ADDRESS } from "@/lib/shipping";

export function ObchodnePodmienkySk({ seller, register }: { seller: SellerIdentity; register: string | null }) {
  return (
    <>
      <h2>I. Základné ustanovenia</h2>
      <p>
        1. Tieto všeobecné obchodné podmienky (ďalej len „obchodné podmienky“) sú vydané podľa § 1751
        a nasl. zákona č. 89/2012 Sb., Občiansky zákonník Českej republiky (ďalej len „občiansky
        zákonník“).
      </p>
      <p>
        {seller.legalName}, IČO: {seller.ico}, so sídlom: {seller.street}, {seller.city}.{" "}
        {seller.vatPayer
          ? `Predávajúci je platiteľom DPH, DIČ: ${seller.dic}.`
          : `Predávajúci nie je platiteľom DPH.${seller.dic ? ` DIČ: ${seller.dic}.` : ""}`}
        {register && (
          <>
            <br />
            {register}.
          </>
        )}
        <br />
        Kontaktné údaje: e-mail: {CONTACT.email}, telefón: {CONTACT.phone}
        <br />
        {CONTACT.website} (ďalej len „predávajúci“)
      </p>
      <p>
        2. Tieto obchodné podmienky upravujú vzájomné práva a povinnosti predávajúceho a fyzickej
        osoby, ktorá uzatvára kúpnu zmluvu mimo svojej podnikateľskej činnosti ako spotrebiteľ, alebo
        v rámci svojej podnikateľskej činnosti (ďalej len „kupujúci“) prostredníctvom webového
        rozhrania umiestneného na webovej stránke dostupnej na internetovej adrese
        https://www.gotridperfume.cz/ (ďalej len „internetový obchod“).
      </p>
      <p>
        3. Ustanovenia obchodných podmienok sú neoddeliteľnou súčasťou kúpnej zmluvy. Odlišné
        dojednania v kúpnej zmluve majú prednosť pred ustanoveniami týchto obchodných podmienok.
      </p>
      <p>
        4. Tieto obchodné podmienky a kúpna zmluva sa uzatvárajú v slovenskom alebo českom jazyku
        podľa toho, v ktorom jazyku kupujúci objednáva.
      </p>

      <h2>II. Informácie o tovare a cenách</h2>
      <p>
        1. Informácie o tovare vrátane uvedenia cien jednotlivého tovaru a jeho hlavných vlastností
        sú uvedené pri jednotlivom tovare v katalógu internetového obchodu. Ceny tovaru sú uvedené
        vrátane všetkých súvisiacich poplatkov a nákladov na vrátenie tovaru, ak tento tovar zo
        svojej podstaty nemôže byť vrátený obvyklou poštovou cestou. Ceny tovaru zostávajú v
        platnosti po dobu, po ktorú sú zobrazované v internetovom obchode.
      </p>
      <p>
        2. Základnou menou internetového obchodu je česká koruna. Pre kupujúcich s doručením na
        Slovensko sú ceny zobrazované a účtované v eurách, prepočítané kurzom, ktorý predávajúci
        stanovuje a uvádza v internetovom obchode; platba kartou prebieha v eurách.
      </p>
      <p>
        3. Všetka prezentácia tovaru umiestnená v katalógu internetového obchodu má informatívny
        charakter a predávajúci nie je povinný uzatvoriť kúpnu zmluvu týkajúcu sa tohto tovaru.
      </p>
      <p>
        4. V internetovom obchode sú zverejnené informácie o nákladoch spojených s balením a dodaním
        tovaru, platné pre doručenie v rámci Českej republiky a Slovenskej republiky.
      </p>
      <p>
        5. Prípadné zľavy z kúpnej ceny tovaru sa nedajú navzájom kombinovať, ak sa predávajúci s
        kupujúcim nedohodne inak.
      </p>

      <h2>III. Objednávka a uzavretie kúpnej zmluvy</h2>
      <p>
        1. Náklady, ktoré kupujúcemu vzniknú pri použití komunikačných prostriedkov na diaľku v
        súvislosti s uzavretím kúpnej zmluvy, hradí kupujúci sám a nelíšia sa od základnej sadzby.
      </p>
      <p>
        2. Kupujúci vykonáva objednávku tovaru prostredníctvom svojho zákazníckeho účtu, alebo
        vyplnením objednávkového formulára bez registrácie.
      </p>
      <p>3. Pri zadávaní objednávky si kupujúci vyberie tovar, počet kusov tovaru, spôsob platby a doručenia.</p>
      <p>
        4. Pred odoslaním objednávky je kupujúcemu umožnené kontrolovať a meniť vložené údaje.
        Objednávku odošle kupujúci kliknutím na tlačidlo „Záväzne objednať“. Podmienkou platnosti
        objednávky je vyplnenie všetkých povinných údajov a potvrdenie oboznámenia sa s týmito
        obchodnými podmienkami.
      </p>
      <p>
        5. Bezodkladne po obdržaní objednávky zašle predávajúci kupujúcemu automatické potvrdenie o
        obdržaní objednávky, ktoré sa nepovažuje za uzavretie zmluvy. Kúpna zmluva je uzavretá až po
        prijatí objednávky predávajúcim.
      </p>
      <p>
        6. Ak niektorú z požiadaviek nemôže predávajúci splniť, zašle kupujúcemu zmenenú ponuku, ktorá
        sa považuje za nový návrh kúpnej zmluvy.
      </p>
      <p>
        7. Všetky prijaté objednávky sú záväzné. Kupujúci môže zrušiť objednávku, kým mu nie je
        doručené oznámenie o jej prijatí, telefonicky alebo e-mailom na kontakty predávajúceho.
      </p>
      <p>
        8. Pri zjavnej technickej chybe v uvedenej cene tovaru nie je predávajúci povinný dodať tovar
        za túto chybnú cenu, a to ani v prípade zaslaného automatického potvrdenia objednávky.
      </p>

      <h2>IV. Zákaznícky účet</h2>
      <p>1. Kupujúci môže pristupovať do svojho zákazníckeho účtu na základe registrácie, alebo objednávať tovar bez registrácie.</p>
      <p>2. Kupujúci je povinný uvádzať správne a pravdivé údaje a aktualizovať ich pri akejkoľvek zmene.</p>
      <p>
        3. Prístup k účtu je zabezpečený používateľským menom a heslom; kupujúci je povinný zachovávať
        mlčanlivosť o týchto údajoch. Predávajúci nenesie zodpovednosť za zneužitie účtu tretími
        osobami.
      </p>
      <p>4. Kupujúci nie je oprávnený umožniť využívanie účtu tretím osobám.</p>
      <p>
        5. Predávajúci môže zrušiť používateľský účet, najmä pri jeho dlhodobom nevyužívaní alebo
        porušení povinností kupujúceho.
      </p>
      <p>6. Účet nemusí byť dostupný nepretržite vzhľadom na nutnú údržbu systémov.</p>

      <h2>V. Platobné podmienky a dodanie tovaru</h2>
      <p>1. Kúpnu cenu je možné uhradiť:</p>
      <ul>
        <li>bezhotovostne prevodom na bankový účet predávajúceho č. 3728844015/3030, vedený v Air Bank,</li>
        <li>bezhotovostne platobnou kartou,</li>
        <li>dobierkou v hotovosti pri prevzatí tovaru,</li>
        <li>v hotovosti alebo platobnou kartou pri osobnom odbere v prevádzkarni.</li>
      </ul>
      <p>
        2. Kupujúci hradí spolu s kúpnou cenou aj náklady spojené s balením a dodaním tovaru v
        dohodnutej výške.
      </p>
      <p>
        3. Kúpna cena v hotovosti je splatná pri prevzatí tovaru, pri bezhotovostnej platbe do 14 dní
        od uzavretia kúpnej zmluvy.
      </p>
      <p>4. Pri platbe cez platobnú bránu postupuje kupujúci podľa pokynov poskytovateľa.</p>
      <p>
        5. Záväzok uhradiť kúpnu cenu bezhotovostne je splnený pripísaním sumy na účet predávajúceho.
      </p>
      <p>6. Predávajúci nepožaduje od kupujúceho žiadnu zálohu.</p>
      <p>
        7. Tovar sa dodáva na adresu určenú kupujúcim, prostredníctvom výdajného miesta zásielok, alebo
        osobným odberom v prevádzkarni predávajúceho.
      </p>
      <p>8. Voľba spôsobu dodania sa vykonáva počas objednávania tovaru.</p>
      <p>
        9. Náklady na dodanie sú uvedené v objednávke a jej potvrdení. Pri osobitnej požiadavke
        kupujúceho na spôsob dopravy nesie kupujúci súvisiace riziko a dodatočné náklady.
      </p>
      <p>
        10. Kupujúci je povinný tovar pri dodaní prevziať; pri nutnosti opakovaného doručenia hradí
        kupujúci súvisiace náklady.
      </p>
      <p>
        11. Pri prevzatí tovaru od prepravcu je kupujúci povinný skontrolovať neporušenosť obalu a
        závady bezodkladne oznámiť prepravcovi.
      </p>
      <p>12. Predávajúci vystaví kupujúcemu daňový doklad – faktúru, zaslanú na e-mail kupujúceho.</p>
      <p>
        13. Vlastnícke právo k tovaru prechádza na kupujúceho zaplatením celej kúpnej ceny, najskôr
        však prevzatím tovaru.
      </p>

      <h2>VI. Odstúpenie od zmluvy</h2>
      <p>
        1. Kupujúci-spotrebiteľ má právo odstúpiť od kúpnej zmluvy do 14 dní odo dňa prevzatia tovaru
        (resp. poslednej/prvej dodávky pri zmluvách s viacerými druhmi tovaru alebo opakovaným
        plnením).
      </p>
      <p>
        2. Odstúpiť nemožno okrem iného pri tovare upravenom na želanie kupujúceho, tovare podliehajúcom
        rýchlej skaze, tovare v uzavretom obale, ktorý kupujúci z hygienických dôvodov rozbalil, a v
        ďalších prípadoch podľa § 1837 občianskeho zákonníka.
      </p>
      <p>
        3. Na odstúpenie možno využiť vzorový formulár, zaslaný na kontaktný e-mail alebo adresu
        predávajúceho; predávajúci bezodkladne potvrdí prijatie.
      </p>
      <p>
        4. Kupujúci vráti tovar predávajúcemu do 14 dní od odstúpenia, na vlastné náklady, ak nie je
        dohodnuté inak.
      </p>
      <p>
        5. Predávajúci vráti prijaté peňažné prostriedky (vrátane nákladov na dodanie) do 14 dní od
        odstúpenia, rovnakým spôsobom, akým boli prijaté.
      </p>
      <p>
        6. Ak kupujúci zvolil drahší než najlacnejší ponúkaný spôsob dodania, vracia predávajúci
        náklady na dodanie vo výške zodpovedajúcej najlacnejšej ponúkanej variante.
      </p>
      <p>
        7. Predávajúci nie je povinný vrátiť peniaze skôr, než obdrží vrátený tovar, alebo kým
        kupujúci nepreukáže jeho odoslanie.
      </p>
      <p>
        8. Vrátený tovar musí byť nepoškodený, neopotrebovaný, neznečistený a ak je to možné, v
        pôvodnom obale.
      </p>
      <p>
        9. Predávajúci je oprávnený odstúpiť od zmluvy pri vypredaní zásob alebo nedostupnosti tovaru,
        s vrátením všetkých platieb kupujúcemu do 14 dní.
      </p>

      <h2>VII. Práva z chybného plnenia</h2>
      <p>
        1. Predávajúci zodpovedá za to, že tovar pri prevzatí nemá vady a zodpovedá dojednaným
        vlastnostiam, účelu použitia, akosti a množstvu podľa vzorky či predlohy a požiadaviek
        právnych predpisov.
      </p>
      <p>
        2. Ak sa vada prejaví do šiestich mesiacov od prevzatia, predpokladá sa, že tovar bol chybný
        už pri prevzatí. Pri spotrebnom tovare možno právo z vady uplatniť do 24 mesiacov od prevzatia.
      </p>
      <p>
        3. Pri vade môže kupujúci požadovať výmenu, opravu, primeranú zľavu, alebo odstúpiť od zmluvy.
      </p>
      <p>
        4. Predávajúci prijme reklamáciu v prevádzkarni alebo sídle a vydá písomné potvrdenie o jej
        obsahu a spôsobe vybavenia, vrátane prípadného odôvodnenia zamietnutia.
      </p>
      <p>
        5. O reklamácii sa rozhodne ihneď, v zložitých prípadoch do troch pracovných dní; reklamácia
        musí byť vybavená najneskôr do 30 dní, ak sa predávajúci s kupujúcim nedohodne na dlhšej lehote.
      </p>
      <p>6. Predávajúci informuje kupujúceho o výsledku reklamácie písomne.</p>
      <p>
        7. Práva z chybného plnenia sa riadia § 1914 až 1925, § 2099 až 2117 a § 2161 až 2174
        občianskeho zákonníka a zákonom č. 634/1992 Sb., o ochrane spotrebiteľa. Práva spotrebiteľa
        vyplývajúce zo záväzných predpisov krajiny jeho obvyklého pobytu tým nie sú dotknuté.
      </p>

      <h2>VIII. Doručovanie</h2>
      <p>
        Zmluvné strany si môžu všetku písomnú korešpondenciu doručovať prostredníctvom elektronickej
        pošty — kupujúci na e-mail predávajúceho uvedený v týchto podmienkach, predávajúci na e-mail
        uvedený kupujúcim v účte alebo objednávke.
      </p>

      <h2>IX. Mimosúdne riešenie sporov</h2>
      <p>
        1. Na mimosúdne riešenie spotrebiteľských sporov je v Českej republike príslušná Česká
        obchodná inšpekcia, so sídlom Štěpánská 567/15, 120 00 Praha 2, IČO: 000 20 869 (adr.coi.cz).
        Slovenský spotrebiteľ sa môže obrátiť aj na subjekt alternatívneho riešenia sporov v
        Slovenskej republike, napr. Slovenskú obchodnú inšpekciu (www.soi.sk), ktorej zoznam
        subjektov ARS je dostupný na stránke Ministerstva hospodárstva SR. Platformu na riešenie
        sporov online nájdete na ec.europa.eu/consumers/odr.
      </p>
      <p>
        2. Európske spotrebiteľské centrum Česká republika, so sídlom Štěpánská 567/15, 120 00 Praha
        2 (evropskyspotrebitel.cz), a Európske spotrebiteľské centrum Slovensko (esc-sr.sk) sú
        kontaktnými miestami podľa nariadenia EÚ č. 524/2013.
      </p>
      <p>
        3. Predávajúci je oprávnený na predaj tovaru na základe živnostenského oprávnenia; kontrolu
        vykonáva príslušný živnostenský úrad a Česká obchodná inšpekcia.
      </p>

      <h2>X. Záverečné ustanovenia</h2>
      <p>
        1. Všetky dojednania medzi predávajúcim a kupujúcim sa riadia právnym poriadkom Českej
        republiky, bez dotknutia práv spotrebiteľa zo všeobecne záväzných predpisov.
      </p>
      <p>2. Predávajúci nie je viazaný žiadnymi kódexmi správania podľa § 1826 ods. 1 písm. e) občianskeho zákonníka.</p>
      <p>
        3. Všetky práva k webovým stránkam, vrátane autorských práv k obsahu, grafike, ochranným
        známkam a logu, patria predávajúcemu; ich kopírovanie bez súhlasu je zakázané.
      </p>
      <p>
        4. Predávajúci nenesie zodpovednosť za chyby vzniknuté zásahmi tretích osôb alebo použitím
        internetového obchodu v rozpore s jeho určením.
      </p>
      <p>5. Kupujúci preberá riziko zmeny okolností v zmysle § 1765 ods. 2 občianskeho zákonníka.</p>
      <p>6. Kúpna zmluva vrátane obchodných podmienok je archivovaná predávajúcim elektronicky a nie je prístupná.</p>
      <p>
        7. Predávajúci môže znenie obchodných podmienok meniť či dopĺňať; tým nie sú dotknuté práva a
        povinnosti vzniknuté počas účinnosti predchádzajúceho znenia.
      </p>
      <p>8. Prílohou obchodných podmienok je vzorový formulár na odstúpenie od zmluvy.</p>

      <p className="text-accent-2">Tieto obchodné podmienky nadobúdajú účinnosť dňom 26. 3. 2026.</p>
    </>
  );
}

export function VratenieTovaruSk({ legalName }: { legalName: string }) {
  return (
    <>
      <h2>1. Právo na odstúpenie od zmluvy</h2>
      <p>
        Kupujúci má právo odstúpiť od kúpnej zmluvy bez uvedenia dôvodu do 14 dní odo dňa prevzatia
        tovaru. Na dodržanie lehoty je potrebné odoslať oznámenie o odstúpení od zmluvy pred jej
        uplynutím.
      </p>

      <h2>2. Podmienky vrátenia tovaru</h2>
      <p>Aby bolo možné tovar vrátiť, musí spĺňať nasledujúce podmienky:</p>
      <ul>
        <li>tovar nesmie byť použitý,</li>
        <li>musí byť nepoškodený,</li>
        <li>musí byť vrátený v pôvodnom obale,</li>
        <li>musí byť kompletný (vrátane príslušenstva, ak je jeho súčasťou).</li>
      </ul>

      <h2>3. Výnimky z odstúpenia</h2>
      <p>Odstúpenie od zmluvy nie je možné v prípade:</p>
      <ul>
        <li>tovaru upraveného podľa želania zákazníka,</li>
        <li>tovaru podliehajúceho rýchlej skaze,</li>
        <li>
          tovaru v uzavretom obale, ktorý bol po dodaní otvorený a z hygienických dôvodov ho nemožno
          vrátiť.
        </li>
      </ul>
      <p>
        To sa vzťahuje najmä na parfumy a kozmetiku, ak bol porušený ochranný obal alebo bol produkt
        použitý.
      </p>

      <h2>4. Chybný alebo nesprávny tovar</h2>
      <p>
        Ak dostanete poškodený tovar alebo tovar, ktorý nezodpovedá objednávke, kontaktujte nás čo
        najskôr po prevzatí zásielky. Odporúčame skontrolovať zásielku ihneď pri doručení. V takom
        prípade hradí náklady na vrátenie predávajúci.
      </p>

      <h2>5. Postup pri vrátení</h2>
      <p>
        Na vrátenie tovaru nás prosím kontaktujte na e-maile info@gotridperfume.cz. Uveďte číslo
        objednávky a dôvod vrátenia (nie je povinný). Môžete využiť aj{" "}
        <NextLink href="/api/dokumenty/odstoupeni-od-smlouvy">
          vzorový formulár na odstúpenie od zmluvy (PDF)
        </NextLink>
        . Po dohode zašlite tovar na adresu:
      </p>
      <p>
        {legalName}
        <br />
        {PICKUP_ADDRESS}
        <br />
        Česká republika
      </p>

      <h2>6. Náklady na vrátenie</h2>
      <p>
        Kupujúci znáša náklady spojené s vrátením tovaru v prípade odstúpenia od zmluvy bez uvedenia
        dôvodu. V prípade chybného alebo nesprávneho tovaru hradí náklady na vrátenie predávajúci.
      </p>

      <h2>7. Vrátenie peňazí</h2>
      <p>
        Po obdržaní a kontrole vráteného tovaru vrátime peňažné prostriedky najneskôr do 14 dní, a to
        rovnakým spôsobom, akým boli prijaté, ak sa nedohodneme inak. Predávajúci nie je povinný
        vrátiť peňažné prostriedky skôr, než obdrží vrátený tovar alebo než kupujúci preukáže, že tovar
        odoslal.
      </p>

      <h2>8. Výmena tovaru</h2>
      <p>
        V prípade záujmu o výmenu tovaru nás prosím kontaktujte e-mailom. Výmena sa rieši individuálne
        podľa dostupnosti tovaru.
      </p>

      <h2>9. Kontaktné údaje</h2>
      <p>
        Internetový obchod: Gotrid Perfume
        <br />
        E-mail: {CONTACT.email}
        <br />
        Telefón: {CONTACT.phone}
      </p>
    </>
  );
}

export function OchranaUdajovSk({ seller }: { seller: SellerIdentity }) {
  return (
    <>
      <h2>I. Základné ustanovenia</h2>
      <p>
        1. Prevádzkovateľom osobných údajov podľa čl. 4 bod 7 nariadenia Európskeho parlamentu a Rady
        (EÚ) 2016/679 (ďalej len „GDPR“) je {seller.legalName}, IČO {seller.ico}, so sídlom{" "}
        {seller.street}, {seller.city} (ďalej len „prevádzkovateľ“).
      </p>
      <p>
        2. Kontaktné údaje prevádzkovateľa: Gotrid Perfume, www.gotridperfume.cz, e-mail {CONTACT.email},
        telefón {CONTACT.phone}.
      </p>
      <p>
        3. Osobnými údajmi sa rozumejú všetky informácie o identifikovanej alebo identifikovateľnej
        fyzickej osobe.
      </p>

      <h2>II. Zdroje a kategórie spracúvaných osobných údajov</h2>
      <p>
        Prevádzkovateľ spracúva osobné údaje, ktoré ste mu poskytli, alebo ktoré získal na základe
        plnenia vašej objednávky — identifikačné a kontaktné údaje a údaje nevyhnutné na plnenie
        zmluvy.
      </p>

      <h2>III. Zákonný dôvod a účel spracúvania osobných údajov</h2>
      <p>Zákonným dôvodom spracúvania je:</p>
      <ul>
        <li>plnenie zmluvy medzi vami a prevádzkovateľom podľa čl. 6 ods. 1 písm. b) GDPR,</li>
        <li>
          oprávnený záujem prevádzkovateľa na poskytovaní priameho marketingu podľa čl. 6 ods. 1 písm.
          f) GDPR,
        </li>
        <li>
          váš súhlas so spracúvaním na účely priameho marketingu podľa čl. 6 ods. 1 písm. a) GDPR v
          spojení s § 7 ods. 2 zákona č. 480/2004 Sb., ak nedošlo k objednávke tovaru alebo služby.
        </li>
      </ul>
      <p>
        Účelom spracúvania je vybavenie objednávky a výkon práv a povinností zo zmluvného vzťahu, a
        zasielanie obchodných oznámení. Zo strany prevádzkovateľa nedochádza k automatizovanému
        individuálnemu rozhodovaniu v zmysle čl. 22 GDPR.
      </p>

      <h2>IV. Doba uchovávania údajov</h2>
      <p>
        Prevádzkovateľ uchováva osobné údaje po dobu nevyhnutnú na výkon práv a povinností zo
        zmluvného vzťahu a uplatňovanie nárokov z neho (15 rokov od skončenia vzťahu), a po dobu
        trvania súhlasu so spracúvaním na marketing (najdlhšie 5 rokov). Po uplynutí doby uchovávania
        prevádzkovateľ osobné údaje vymaže.
      </p>

      <h2>V. Príjemcovia osobných údajov</h2>
      <p>Príjemcami osobných údajov sú osoby:</p>
      <ul>
        <li>podieľajúce sa na dodaní tovaru a realizácii platieb na základe zmluvy,</li>
        <li>zabezpečujúce prevádzku e-shopu a súvisiace služby,</li>
        <li>zabezpečujúce marketingové služby.</li>
      </ul>
      <p>
        Prevádzkovateľ má v úmysle preniesť osobné údaje do tretej krajiny (mimo EÚ) — príjemcami v
        tretích krajinách sú poskytovatelia mailingových a cloudových služieb.
      </p>

      <h2>VI. Vaše práva</h2>
      <p>Za podmienok stanovených v GDPR máte právo na:</p>
      <ul>
        <li>prístup k svojim osobným údajom (čl. 15 GDPR),</li>
        <li>opravu osobných údajov, prípadne obmedzenie spracúvania (čl. 16, 18 GDPR),</li>
        <li>vymazanie osobných údajov (čl. 17 GDPR),</li>
        <li>vznesenie námietky proti spracúvaniu (čl. 21 GDPR),</li>
        <li>prenosnosť údajov (čl. 20 GDPR),</li>
        <li>odvolanie súhlasu so spracúvaním písomne alebo elektronicky na kontakty prevádzkovateľa.</li>
      </ul>
      <p>
        Máte tiež právo podať sťažnosť na Úrad pre ochranu osobných údajov (Česká republika) alebo na
        Úrad na ochranu osobných údajov Slovenskej republiky (dataprotection.gov.sk), ak sa domnievate,
        že bolo porušené vaše právo na ochranu osobných údajov.
      </p>

      <h2>VII. Podmienky zabezpečenia osobných údajov</h2>
      <p>
        Prevádzkovateľ prijal vhodné technické a organizačné opatrenia na zabezpečenie osobných
        údajov, vrátane zabezpečenia prístupov heslami, šifrovania komunikácie (SSL) a obmedzenia
        prístupu k údajom iba povereným osobám.
      </p>

      <h2>VIII. Cookies</h2>
      <p>
        Webové stránky používajú cookies na zabezpečenie správneho fungovania, analýzu návštevnosti a
        marketing. Používanie analytických a marketingových cookies (Meta Pixel) je založené na
        súhlase udelenom prostredníctvom cookie lišty a možno ho kedykoľvek odvolať.
      </p>

      <h2>IX. Záverečné ustanovenia</h2>
      <p>
        Odoslaním objednávky alebo zaškrtnutím súhlasu prostredníctvom formulára potvrdzujete, že ste
        sa oboznámili s týmito podmienkami a v celom rozsahu ich prijímate. Prevádzkovateľ je
        oprávnený tieto podmienky zmeniť; novú verziu zverejní na webe a zašle na e-mail uvedený
        prevádzkovateľovi.
      </p>
    </>
  );
}

export function ONasSk() {
  return (
    <>
      <div className="not-prose mb-2 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Image
          src="/o-nas-pavel.jpg"
          alt="Pavel Hrytsan, zakladateľ Gotrid Perfume"
          width={800}
          height={800}
          className="h-36 w-36 shrink-0 rounded-sm border border-line object-cover sm:h-44 sm:w-44"
        />
        <p className="text-sm leading-relaxed text-ink/80">
          Volám sa Pavel (Pavlo) Hrytsan a Gotrid Perfume som založil v roku 2023.
        </p>
      </div>
      <p>
        Začínal som v malom — predával som výpredajové a outletové parfumy: testery bez škatuliek,
        fľaše s mierne nižším objemom alebo inak drobne použité kusy, vždy však za naozaj dobrú cenu.
        Bol to skôr experiment, na ktorom som nazbieral veľa skúseností a naučil sa, ako tento odbor
        skutočne funguje.
      </p>
      <p>
        Skúšal som aj ďalšie cesty — s kamarátom sme napríklad na čas prevádzkovali automat na parfumy
        v obchodnom centre na Smíchove. Bol to ďalší experiment, z ktorého som si odniesol ďalšie
        skúsenosti.
      </p>
      <figure className="not-prose my-2 flex flex-col items-center gap-2">
        <Image
          src="/o-nas-automat.png"
          alt="Parfumový automat Gotrid Perfume v obchodnom centre na Smíchove"
          width={1179}
          height={2074}
          className="h-auto w-full max-w-[220px] rounded-sm border border-line"
        />
        <figcaption className="text-xs text-accent-2">
          Náš parfumový automat v obchodnom centre na Smíchove
        </figcaption>
      </figure>
      <p>
        Pri parfumérii som zostal, pretože ma táto oblasť jednoducho baví, a obchod som postupne
        rozvíjal ďalej. Dnes už máme oveľa širší a stabilnejší sortiment — parfumy aj kozmetiku. Okrem
        e-shopu zásobujeme aj dve kamenné predajne a venujeme sa veľkoobchodnému predaju po celej
        Európe. Stále sa však držíme rovnakého princípu, s ktorým som začínal: poctivá cena bez
        zbytočnej maloobchodnej prirážky a 100 % originálny tovar priamo od distribútorov.
      </p>

      <h2>Čo ponúkame</h2>
      <ul>
        <li>parfumy a kozmetiku popredných značiek,</li>
        <li>100 % originálne produkty so zárukou originality,</li>
        <li>pravidelne aktualizovaný sortiment.</li>
      </ul>

      <h2>Ako fungujeme</h2>
      <p>
        Tovar starostlivo vyberáme a kontrolujeme pred odoslaním. Objednávky spracúvame čo
        najrýchlejšie, aby bolo doručenie v čo najkratšom čase.
      </p>

      <h2>Kontakt</h2>
      <p>
        E-mail: {CONTACT.email}
        <br />
        Telefón: {CONTACT.phone}
        <br />
        Adresa: {PICKUP_ADDRESS}, Česká republika
      </p>

      <h2>Prevádzková doba</h2>
      <p>
        Po–Pi: 9:00–18:00
        <br />
        So–Ne: zatvorené
      </p>
    </>
  );
}

export function ZarukaOriginalitySk() {
  return (
    <>
      <p>
        Tovar nakupujeme priamo od overených distribútorov a partnerov v Českej republike a Európskej
        únii, vďaka čomu vám môžeme ponúknuť značkovú parfumériu a kozmetiku za poctivú cenu, bez
        zbytočnej maloobchodnej prirážky.
      </p>
      <p>Každý produkt je pred odoslaním starostlivo skontrolovaný.</p>

      <h2>Doklady o pôvode tovaru</h2>
      <p>
        K dispozícii máme faktúry a doklady o nákupe od našich dodávateľov a partnerov, ktoré
        potvrdzujú legálny pôvod predávaného tovaru.
      </p>

      <h2>Transparentnosť</h2>
      <p>
        Naším cieľom je transparentný a férový predaj. V prípade akýchkoľvek otázok nás môžete
        kontaktovať prostredníctvom e-mailu alebo kontaktného formulára.
      </p>
    </>
  );
}

export function DopravaPlatbaSk({ price, freeFrom, codSurcharge, codLimit, prices, paymentInfo }: {
  /** Gateway block (Comgate) shown right after the payment methods list. */
  paymentInfo?: React.ReactNode;
  price: (czk: number) => string;
  freeFrom: number;
  codSurcharge: number;
  codLimit: number;
  prices: { zasilkovna: number; zasilkovnaHd: number; glsMisto: number; gls: number };
}) {
  return (
    <>
      <h2>1. Spôsoby dopravy</h2>
      <p>
        Tovar doručujeme do Slovenskej republiky a Českej republiky prostredníctvom overených
        dopravcov. Pri objednávke si môžete zvoliť nasledujúce možnosti doručenia na Slovensko:
      </p>
      <ul>
        <li>
          Zásilkovna — výdajné miesto podľa vášho výberu: {price(prices.zasilkovna)}, doba doručenia
          2–4 pracovné dni,
        </li>
        <li>
          Zásilkovna — doručenie na adresu: {price(prices.zasilkovnaHd)}, doba doručenia 2–4
          pracovné dni,
        </li>
        <li>
          GLS — výdajné miesto/box podľa vášho výberu: {price(prices.glsMisto)}, doba doručenia 2–4
          pracovné dni,
        </li>
        <li>
          GLS kuriér — doručenie na adresu: {price(prices.gls)}, doba doručenia 2–4 pracovné dni.
        </li>
      </ul>
      <p>
        Doprava zdarma pri objednávke nad {price(freeFrom)}. Osobný odber ({PICKUP_ADDRESS}, Praha) je
        dostupný len pre doručenie v Českej republike.
      </p>

      <h2>2. Spracovanie objednávky</h2>
      <p>
        Objednávky prijaté do 12:00 sú zvyčajne odoslané ešte v ten istý pracovný deň, ostatné
        objednávky nasledujúci pracovný deň.
      </p>

      <h2>3. Spôsoby platby</h2>
      <ul>
        <li>Platba kartou online — rýchla a bezpečná platba v eurách (podporuje aj Apple Pay a Google Pay),</li>
        <li>Bankový prevod — QR platba s údajmi zaslanými po dokončení objednávky,</li>
        <li>
          Dobierka — platba v hotovosti alebo kartou pri prevzatí zásielky (príplatok{" "}
          {price(codSurcharge)}, dostupné len do {price(codLimit)}; nedostupné pri doručení cez GLS na
          Slovensko).
        </li>
      </ul>
      {paymentInfo}

      <h2>4. Dôležité informácie</h2>
      <p>
        O odoslaní objednávky budete informovaní e-mailom, vrátane sledovacieho čísla zásielky. V
        prípade neprevzatia zásielky si vyhradzujeme právo účtovať vzniknuté náklady na dopravu.
      </p>

      <h2>5. Kontaktné údaje</h2>
      <p>
        E-mail: info@gotridperfume.cz
        <br />
        Telefón: {CONTACT.phone}
      </p>
      <p className="text-xs text-accent-2">
        <Link href="/obchodni-podminky">Obchodné podmienky</Link>
      </p>
    </>
  );
}
