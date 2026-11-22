# Merchant Center: стартова хвиля (23.11.2026)

Фід: https://www.gotridperfume.cz/feeds/google-start.xml (≈712 товарів: K-beauty GVS 82, Palacio 33, арабські парфуми 597).
Основний великий фід (НЕ підключати поки): https://www.gotridperfume.cz/feeds/google.xml (≈7 000).

## Кроки в Merchant Center (info@ акаунт, id 5907167670)
1. Продукти → «Správa zdrojů produktů» (Správa datových zdrojů) → «Přidat zdroj produktů».
2. Спосіб: «Zadat vlastní» / «Naplánované stažení» (Fetch) → країна Česko, мова čeština.
3. Назва: `Start wave`; URL: https://www.gotridperfume.cz/feeds/google-start.xml ; щоденно, час 06:00.
4. Після завантаження: «Diagnostika» → переглянути причини відхилення.
5. Автосбор («Automaticky zjištěné» / Automatizace): вимкнути, щоб не було дублікатів (10,6 тис.). НЕ видаляти, якщо не впевнені: просто вимкнути.
6. CSS (порівняльник) НЕ обирати, поки фід не оброблено і не показано нормальних статусів.
7. Потім за днями: розширювати: 1) масова косметика (Nivea, Dove…), 2) свічки Yankee/WoodWick, 3) решта.

## Чому так
- Google оцінює тільки те, що ми самі надіслали.
- У фіді: google_product_category, лише в наявності, валідний GTIN, бренд, фото, опис ≥ 80 знаків, без «zdarma/sleva/akce» в назві.
- Люксові/ніші бренди заблоковані двічі (allowlist + чорний список у `isGoogleListable`).
