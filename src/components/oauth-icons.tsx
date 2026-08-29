// "eska" (Seznam's login mark) traced from the official brand kit —
// vyvojari.seznam.cz/oauth/doc → "Přihlásit přes Seznam - manuál.pdf". The
// manual's monochrome variant explicitly allows swapping black for a dark
// grey while keeping contrast, so this uses currentColor to track the
// button's text color instead of a hardcoded black.
export function SeznamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M1.787 36c6.484 0 32.915-3.09 32.915-11.363 0-5.04-6.752-7.444-9.526-8.25-5.286-1.533-9.574-3.115-9.574-4.502 0-1.386 3.004-1.677 6.229-2.39 4.295-.95 6.102-1.474 6.102-3.758 0-1.488-1.143-3.304-1.724-4.086C25.195.288 25.034 0 24.703 0c-.716 0-.15.927-8.231 2.29-5.119.863-11.932 3.168-11.932 7.836 0 4.667 6.092 6.833 12.192 9.041 6.286 2.275 11.542 3.106 11.542 6.735 0 5.788-24.84 9.441-26.45 9.709-.753.125-.63.389-.038.389z"
      />
    </svg>
  );
}

// Meta's brand mark keeps its official blue regardless of surrounding button
// color — recoloring it isn't allowed under Meta's brand guidelines either.
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}
