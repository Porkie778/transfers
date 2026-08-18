# Stock Transfers — Dundrum ⇄ Trinity St.

A small web app for logging and tracking stock transfers between two
store locations. Free to run, hosted entirely on GitHub Pages, with
Firebase Firestore as the shared database so the whole staff sees the
same live list.

## What it does

- Log a transfer with one or more items — each with product name,
  SKU, colour code, and quantity — plus direction, customer name +
  contact (optional), and notes.
- Dashboard with counts of Pending / In transit / Received / Total.
- Staff can update a transfer's status as it moves.
- Search and filter by product, SKU, colour, customer, status, or
  direction.
- Simple shared-password screen (password stored as a hash, not
  plaintext) to keep it off Google and casual visitors, with a
  logout button. See the security note below for what this does and
  doesn't protect against.

## 1. Create your Firebase project (free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Name it anything (e.g. `stock-transfers`). You can skip Google Analytics.
2. Once created, click the **</> (web)** icon on the project overview page to register a web app. Give it any nickname — you don't need Firebase Hosting.
3. Firebase will show you a `firebaseConfig` object with keys like `apiKey`, `authDomain`, etc. Copy these.
4. Open `firebase-config.js` in this project and paste your values into the `firebaseConfig` object, replacing the `REPLACE_ME` placeholders.
5. Set your own store password. The file stores a SHA-256 **hash** of the password, not the password itself, so it isn't sitting in plain text in your page source. To generate the hash:
   - Deploy the site (or run it locally), open it in a browser, open the developer console (F12), and run:
     ```js
     await hashPassword("your-new-password")
     ```
   - Copy the printed hash string and paste it as the value of `STORE_PASSWORD_HASH` in `firebase-config.js`, replacing the default (which is the hash for `changeme`).

## 2. Set up Firestore

1. In the Firebase console, go to **Build → Firestore Database → Create database**.
2. Choose **Start in test mode** for now (see security note below), pick a region close to Ireland (e.g. `europe-west1`), and click **Enable**.
3. That's it — the app creates its own `transfers` collection automatically the first time someone logs a transfer.

### Restricting by IP address

GitHub Pages doesn't support IP allowlisting itself — it's static
hosting with no server-side config. If you need to restrict access to
specific IPs, put the site behind **Cloudflare** (free tier): point
your domain's DNS through Cloudflare, then add a WAF custom rule to
allow or block by IP range. Alternatively, **Cloudflare Access** (also
free for small teams) can replace the shared password entirely with a
proper login (email one-time code, Google login, etc.) in front of
the site.

### Security note

Hashing the password means it isn't readable at a glance in the page
source, but it isn't full security — a hash of a short, guessable
password can still be brute-forced offline by someone determined to.
Treat this the same as a "staff door code": a mild deterrent, not a
lock. The Firestore rules below matter more, since those actually
control who can read or write the data itself.

"Test mode" leaves the database open to anyone with your config values
for 30 days, then it locks automatically. For a small internal tool
that's often fine, but if you want it locked down properly, go to
**Firestore Database → Rules** and use something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transfers/{transferId} {
      allow read, write: if true; // anyone with the app URL + password
    }
  }
}
```

This still isn't real authentication — the shared password is a
deterrent, not a lock. If you later want proper per-user logins,
Firebase Authentication (email/password) is the natural next step and
plugs into the same project.

## 3. Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `stock-transfers`).
2. Add all the files from this project (`index.html`, `styles.css`, `app.js`, `firebase-config.js`, `README.md`) to the repo and push to the `main` branch.
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`. Save.
5. Wait a minute, then your app will be live at `https://<your-username>.github.io/<repo-name>/`.

## 4. Using the app

- Share the URL and the store password with staff.
- Click **New transfer** to log one — use **+ Add item** to add more than one product to the same order (each with its own product name, SKU, colour code, and quantity).
- Change the **Status** dropdown on any row to move it from Pending → In transit → Received — updates appear for everyone in real time.
- Use the search box and filters above the table to find a specific transfer (matches on product, SKU, colour, or customer).
- Click **Log out** in the top bar to lock the app again on that device.

## Customizing

- Colors, fonts, and spacing all live in `styles.css` as CSS variables at the top of the file.
- To rename the two locations, search `app.js` and `index.html` for "Dundrum" and "Trinity St." and update the direction labels and option values together.
