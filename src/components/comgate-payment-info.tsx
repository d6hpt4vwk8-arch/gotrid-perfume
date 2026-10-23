/**
 * "Doprava a platba" block Comgate asks every merchant to publish: who runs the gateway (with a link), how card
 * payments work (with their help page) and where to complain about a payment. Czech and Slovak copy. Bank buttons are
 * not offered through Comgate (our own QR/transfer is free and instant), so they are not described here.
 */
export function ComgatePaymentInfo({ lang }: { lang: "cs" | "sk" }) {
  const sk = lang === "sk";
  return (
    <>
      <p>
        {sk ? (
          <>
            <strong>Platby kartou</strong> zabezpečuje platobná brána spoločnosti{" "}
            <a href="https://www.comgate.eu/cs/platebni-brana" target="_blank" rel="noopener noreferrer">
              Comgate, a.s.
            </a>
          </>
        ) : (
          <>
            <strong>Platby kartou</strong> zajišťuje platební brána společnosti{" "}
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
              ): na zabezpečenej stránke Comgate zadáte údaje karty Visa alebo Mastercard (prípadne zvolíte Apple Pay alebo Google Pay) a platbu potvrdíte overením
              v banke (3D Secure). Po dokončení sa vrátite späť do obchodu. Údaje o karte obchod nikdy nevidí.
            </>
          ) : (
            <>
              Platba kartou (
              <a href="https://help.comgate.eu/v1/docs/cs/platby-kartou" target="_blank" rel="noopener noreferrer">
                jak platba kartou probíhá
              </a>
              ): na zabezpečené stránce Comgate zadáte údaje karty Visa nebo Mastercard (případně zvolíte Apple Pay nebo Google Pay) a platbu potvrdíte ověřením
              v bance (3D Secure). Po dokončení se vrátíte zpět do obchodu. Údaje o kartě obchod nikdy nevidí.
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
