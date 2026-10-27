# Nakhla Client

React + Vite + Tailwind CSS frontend in Central Kurdish (Sorani), right-to-left,
with a light theme and a dark "lounge" theme. It talks to the Nakhla backend on
`http://localhost:5000`.

    client/
    ├── index.html                      RTL page, fonts, theme (no flash)
    ├── vite.config.js
    ├── public/favicon.svg
    └── src/
        ├── main.jsx
        ├── App.jsx                     page layout, routes, cart + exchange rate state
        ├── index.css                   colours (light / dark), fonts, torn-paper edges, motion
        ├── config.js                   API_URL (backend address)
        ├── navigation.js               the five pages of the menu
        ├── context/
        │   ├── uiContext.js
        │   └── UiProvider.jsx          toast messages + confirm dialogs
        ├── hooks/
        │   ├── useUi.js                const { toast, confirm } = useUi()
        │   ├── useTheme.js             light / dark
        │   └── useGuardedNavigate.js   asks before leaving the POS with a full cart
        ├── components/
        │   ├── Sidebar.jsx             green side menu (large screens)
        │   ├── MobileNav.jsx           tab bar (phones)
        │   ├── TopBar.jsx              date, theme button
        │   ├── ProductRow.jsx          one product of the POS list
        │   ├── CartItem.jsx            one line of the cart
        │   ├── ProductDrawer.jsx       side panel to add / edit a product
        │   ├── Receipt.jsx             the single-sale wasl as a paper slip (shows returns)
        │   ├── ReceiptModal.jsx        wasl window with print / return / delete
        │   ├── WaslViewer.jsx          opens a wasl and reads it again after a return
        │   ├── ReturnDialog.jsx        choose products and quantities to return
        │   ├── StatementReceipt.jsx    combined customer statement (کشف حساب, A4)
        │   ├── StatementModal.jsx, StatementDialog.jsx   complete / date-range choice
        │   ├── CustomerPicker.jsx, CustomerDrawer.jsx    choose / add a customer
        │   ├── PaymentModal.jsx        record an installment
        │   ├── DateInput.jsx           date box that always shows 0-9
        │   ├── BarChart.jsx, Segmented.jsx, EmptyState.jsx, PageHeader.jsx
        │   ├── ToastStack.jsx, ConfirmDialog.jsx
        │   └── Icon.jsx, PalmLogo.jsx
        ├── pages/
        │   ├── Dashboard.jsx           today's takings (dinar | dollar), 7-day chart
        │   ├── POS.jsx                 new wasl: product list + cart ticket
        │   ├── Products.jsx            products and their units / USD prices
        │   ├── Customers.jsx, CustomerProfile.jsx   credit customers, installments
        │   ├── Wasls.jsx               all wasls, grouped by day
        │   └── Reports.jsx             7 / 30 / 90 day reports
        └── utils/
            ├── format.js               Arabic digits, money, dates, Kurdish search
            ├── returns.js              return labels, status, preview of a return
            └── pricing.js              IQD <-> USD prices and wasl totals

## Run

1. Start the backend first (`npm run dev` in the backend folder, port 5000).
2. In this folder:

       npm install
       npm run dev

3. Open http://localhost:5173

## Good to know

- **Colours and fonts** live in `src/index.css` (variables at the top). Change a
  value there and the whole app follows, in both themes.
- **Shop name:** change `SHOP_NAME` in `src/config.js` (sidebar, browser tab,
  receipts). The statement address and phone numbers are in the same file.
- **Money:** everything is USD. `25.00` shows as `$25`, `10.5` stays `$10.5`.
- **Digits:** every number and date is shown with 0-9. If someone types Arabic digits
  (٣٥٠٠) the box converts them while typing.
- **Search:** Arabic and Kurdish letters match each other (ي = ی, ك = ک) and
  diacritics are ignored, the same rules as the database.
- **Returns:** open a wasl (Wasls page, or a customer's credit sales) and press
  «گەڕاندنەوەی کاڵا». Labels: a returned product shows «گەڕاوەتەوە» with its
  quantity; a wasl with everything returned shows «وەسڵەکە بە کاملی گەڕاوەتەوە»; part of
  a wasl returned shows «بەشێکی گەڕاوەتەوە». The status always comes from the saved quantities.
- **Stock:** optional per unit (Products -> Edit). Empty = not tracked.
- **Wasl:** prices of products always come from the database. A wasl is cash or credit;
  a credit wasl belongs to a customer, has no discount, and adds to their debt.
- **Phones:** the cart becomes a sheet that opens from a gold bar at the bottom.
- **Printing:** the wasl window has a print button, laid out for an 80mm receipt
  printer or normal paper.
- **Backend address:** change `API_URL` in `src/config.js` if the backend runs
  somewhere else.
