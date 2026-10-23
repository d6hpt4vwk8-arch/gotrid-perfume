/**
 * "Doprava a platba" block Comgate asks every merchant to publish: who runs the gateway (with a link), how card and
 * bank-button payments work (with their help pages) and where to complain about a payment. Czech and Slovak copy.
 */
export function ComgatePaymentInfo({ lang }: { lang: "cs" | "sk" }) {
  const sk = lang === "sk";
  return (
    <>
      <p>
        {sk ? (
          <>
            <strong>Platby kartou a cez internet banking</strong> zabezpečuje platobná brána spoločnosti{" "}
            <a href="https://www.comgate.eu/cs/platebni-brana" target="_blank" rel="noopener noreferrer">
              Comgate, a.s.
            </a>
          </>
        ) : (
          <>
            <strong>Platby kartou a online bankovnictvím</strong> zajišťuje platební brána společnosti{" "}
            <a href="https://www.comgate.eu/cs/platebni-brana" target="_blank" rel="noopener noreferrer">
              Comgate, a.s.
            </a>
          </>
        )}
      </p>
      <ul>
        <li>
          {sk ? (
            <>
              Platba kartou (
              <a href="https://help.comgate.eu/v1/docs/cs/platby-kartou" target="_blank" rel="noopener noreferrer">
                ako platba kartou prebieha
              </a>
              ): na zabezpečenej stránke Comgate zadáte údaje karty Visa alebo Mastercard a platbu potvrdíte overením
              v banke (3D Secure). Po dokončení sa vrátite späť do obchodu. Údaje o karte obchod nikdy nevidí.
            </>
          ) : (
            <>
              Platba kartou (
              <a href="https://help.comgate.eu/v1/docs/cs/platby-kartou" target="_blank" rel="noopener noreferrer">
                jak platba kartou probíhá
              </a>
              ): na zabezpečené stránce Comgate zadáte údaje karty Visa nebo Mastercard a platbu potvrdíte ověřením
              v bance (3D Secure). Po dokončení se vrátíte zpět do obchodu. Údaje o kartě obchod nikdy nevidí.
            </>
          )}
        </li>
        <li>
          {sk ? (
            <>
              Platobné tlačidlá bánk (
              <a href="https://help.comgate.eu/docs/bankovni-prevody" target="_blank" rel="noopener noreferrer">
                ako platba tlačidlom prebieha
              </a>
              ): vyberiete svoju banku, prihlásite sa do internet bankingu a potvrdíte predvyplnenú platbu; potom ste
              automaticky vrátení do obchodu.
            </>
          ) : (
            <>
              Platební tlačítka bank (
              <a href="https://help.comgate.eu/docs/bankovni-prevody" target="_blank" rel="noopener noreferrer">
                jak platba tlačítkem probíhá
              </a>
              ): vyberete svou banku, přihlásíte se do internetového bankovnictví a potvrdíte předvyplněnou platbu;
              poté jste automaticky vráceni do obchodu.
            </>
          )}
        </li>
      </ul>
      <p>
        {sk ? "Reklamácie a otázky k platbám" : "Reklamace a dotazy k platbám"}: Comgate, a.s., Gočárova třída 1754/48b,
        500 02 Hradec Králové; e-mail{" "}
        <a href="mailto:podpora@comgate.cz">podpora@comgate.cz</a>; {sk ? "telefón" : "telefon"} +420 228 224 267.
      </p>
    </>
  );
}
