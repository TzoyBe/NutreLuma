# Οδηγός φιλοξενίας (hosting)

Δύο δρόμοι για να βγει η εφαρμογή στο internet με HTTPS:

- **Επιλογή A** — μένει στο NAS, βγαίνει μέσω Cloudflare Tunnel. **0 €/μήνα.**
- **Επιλογή B** — μετακομίζει σε VPS στη Hetzner. **~4,50 €/μήνα.** *(συνιστάται)*

Και οι δύο δίνουν πραγματικό HTTPS και σταθερή διεύθυνση. Δεν χρειάζεται καμία
αλλαγή στον κώδικα της εφαρμογής — μόνο ρυθμίσεις.

---

## Πίνακας περιεχομένων

1. [Τι χρειάζεται και στις δύο περιπτώσεις](#1-τι-χρειάζεται-και-στις-δύο-περιπτώσεις)
2. [Πόσους πόρους θέλει πραγματικά](#2-πόσους-πόρους-θέλει-πραγματικά)
3. [Επιλογή A — NAS + Cloudflare Tunnel](#3-επιλογή-a--nas--cloudflare-tunnel)
4. [Επιλογή B — Hetzner VPS + Caddy](#4-επιλογή-b--hetzner-vps--caddy)
5. [Μεταφορά δεδομένων από το NAS στο VPS](#5-μεταφορά-δεδομένων-από-το-nas-στο-vps)
6. [Αντίγραφα ασφαλείας](#6-αντίγραφα-ασφαλείας)
7. [Τι ξεκλειδώνεται μόλις υπάρχει δημόσιο URL](#7-τι-ξεκλειδώνεται-μόλις-υπάρχει-δημόσιο-url)
8. [Επιστροφή σε προηγούμενη κατάσταση](#8-επιστροφή-σε-προηγούμενη-κατάσταση)

---

## 1. Τι χρειάζεται και στις δύο περιπτώσεις

### Domain

Απαραίτητο. Κόστος ~10-15 €/χρόνο. Ενδεικτικοί καταχωρητές: Namecheap,
Porkbun, Cloudflare Registrar (πουλά στην τιμή κόστους), papaki.gr για `.gr`.

Στον οδηγό χρησιμοποιείται το `nutreluma.com` — αντικατάστησέ το παντού.

### Γιατί HTTPS δεν είναι προαιρετικό

- Stripe και PayPal **απαιτούν** HTTPS.
- Τα session cookies γίνονται `Secure` και `__Host-` **μόνο** πάνω από https.
  Η εφαρμογή το κάνει αυτόματα με βάση το `APP_URL` — δεν αλλάζεις κώδικα.
- Χωρίς HTTPS, κωδικοί και cookies ταξιδεύουν σε καθαρό κείμενο.

### ⚠️ Τι να ΜΗΝ κάνεις

**Μην κάνεις port-forward τη θύρα 8095 του NAS στο router.** Εκθέτεις ολόκληρο
το NAS —με όλα τα προσωπικά σου αρχεία— σε αυτοματοποιημένη σάρωση 24 ώρες το
24ωρο. Το Cloudflare Tunnel της Επιλογής A υπάρχει ακριβώς για να το αποφύγεις.

---

## 2. Πόσους πόρους θέλει πραγματικά

Μετρημένα από την τρέχουσα εγκατάσταση:

| | Τιμή |
|---|---|
| RAM σε ηρεμία | web 99 MB + db 41 MB = **~140 MB** |
| RAM σε ανάλυση εικόνας | ~350 MB αιχμή (το `sharp` είναι το βαρύ κομμάτι) |
| Μέγεθος βάσης | 8,5 MB |
| Αποθήκευση εικόνων | **~135 KB ανά γεύμα** (full + thumbnail) |
| Docker image | 1,05 GB |

**Πρόβλεψη δίσκου:** 50 ενεργοί χρήστες × 3 γεύματα/ημέρα ≈ **600 MB/μήνα**.
Δίσκος 40 GB επαρκεί για πάνω από 4 χρόνια.

> **Προσοχή στη μνήμη του build:** το `next build` θέλει ~2 GB RAM. Το
> *τρέξιμο* θέλει 10× λιγότερα. Σε μηχάνημα με 2 GB πρόσθεσε swap (οδηγίες στην
> Επιλογή B).

---

## 3. Επιλογή A — NAS + Cloudflare Tunnel

Ο tunnel δημιουργεί **εξερχόμενη** σύνδεση από το NAS προς την Cloudflare.
Δεν ανοίγει καμία θύρα στο router, δεν χρειάζεται στατική IP, και η οικιακή σου
IP δεν φαίνεται πουθενά.

```
Internet → Cloudflare (TLS) → tunnel → cloudflared (NAS) → web:3000
```

### Βήμα 1 — Domain στην Cloudflare

1. Λογαριασμός στο [cloudflare.com](https://dash.cloudflare.com) (δωρεάν).
2. **Add a site** → γράψε το domain σου.
3. Η Cloudflare σου δίνει δύο nameservers. Πήγαινε στον καταχωρητή όπου
   αγόρασες το domain και άλλαξε τους nameservers σε αυτούς.
4. Περίμενε την επιβεβαίωση (συνήθως λεπτά, μερικές φορές ώρες).

### Βήμα 2 — Δημιουργία tunnel

1. Στο Cloudflare dashboard: **Zero Trust** → **Networks** → **Tunnels**.
2. **Create a tunnel** → τύπος **Cloudflared** → όνομα `nutreluma`.
3. Στην οθόνη εγκατάστασης αντίγραψε **μόνο το token** (η μακριά συμβολοσειρά
   μετά το `--token`). Είναι μυστικό — μην το μοιραστείς.
4. Στην καρτέλα **Public Hostname** πρόσθεσε:
   - Subdomain: *(κενό)* · Domain: `nutreluma.com`
   - Service Type: **HTTP** · URL: `web:3000`
5. Πρόσθεσε και δεύτερο hostname για το `www` αν το θέλεις.

> Το `web:3000` δουλεύει επειδή το `cloudflared` θα τρέχει **στο ίδιο Docker
> network** με την εφαρμογή. Δεν χρειάζεται καμία θύρα στο host.

### Βήμα 3 — Πρόσθεσε το cloudflared στο compose

Δημιούργησε στο `/share/Container/nutreluma/` το αρχείο
`docker-compose.tunnel.yml`:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: nutreluma-tunnel
    restart: unless-stopped
    # Χωρίς δικαιώματα root και χωρίς εκτεθειμένη θύρα: κάνει μόνο
    # εξερχόμενη σύνδεση προς την Cloudflare.
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      web:
        condition: service_healthy
    # ΑΠΑΡΑΙΤΗΤΟ: το base compose ορίζει δικό του δίκτυο `nutreluma`.
    # Χωρίς αυτή τη γραμμή το cloudflared προσαρτάται στο default δίκτυο, ΔΕΝ
    # βλέπει το `web`, και η Cloudflare επιστρέφει 502 — ενώ ο tunnel φαίνεται
    # μια χαρά συνδεδεμένος στα logs. Δύσκολο να εντοπιστεί εκ των υστέρων.
    networks:
      - nutreluma
```

Έλεγχος ότι όντως βλέπει την εφαρμογή:

```sh
docker run --rm --network nutreluma_nutreluma alpine \
  wget -qO- http://web:3000/api/health
# Αναμενόμενο: {"status":"ok","database":"up"}
```

Πρόσθεσε το token στο `.env`:

```sh
cd /share/Container/nutreluma
echo "" >> .env
echo "# Cloudflare Tunnel" >> .env
echo "CLOUDFLARE_TUNNEL_TOKEN=το_token_σου" >> .env
```

### Βήμα 4 — Άλλαξε το APP_URL σε https

**Αυτό είναι το κρίσιμο βήμα.** Από εδώ τα cookies γίνονται `Secure`.

```sh
sed -i 's|^APP_URL=.*|APP_URL=https://nutreluma.com|' .env
```

### Βήμα 5 — Σήκωσε τα πάντα

```sh
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy; export DOCKER_CONFIG=$HOME/.docker
cd /share/Container/nutreluma

docker compose -f docker-compose.yml -f docker-compose.tunnel.yml \
  --env-file .env up -d
```

### Βήμα 6 — Επαλήθευση

```sh
# Ο tunnel συνδέθηκε;
docker logs nutreluma-tunnel --tail 20 | grep -i "registered\|connection"

# Απαντά το site;
curl -sI https://nutreluma.com/api/health

# Τα cookies είναι Secure;
curl -sI https://nutreluma.com/login | grep -i set-cookie
```

Άνοιξε `https://nutreluma.com` στο κινητό, **εκτός WiFi σπιτιού**, για να
επιβεβαιώσεις ότι δουλεύει από παντού.

### Μετά τη μετάβαση

Η παλιά διεύθυνση `http://192.168.2.249:8095` **συνεχίζει να δουλεύει** στο
τοπικό δίκτυο, αλλά το login θα αποτυγχάνει εκεί: τα cookies είναι πλέον
`Secure` και ο browser δεν τα στέλνει πάνω από http. **Χρησιμοποίησε πάντα το
domain**, ακόμη και από το σπίτι.

### Περιορισμοί που πρέπει να ξέρεις

| Θέμα | Επίπτωση |
|---|---|
| Διακοπή ρεύματος / internet | Η υπηρεσία πέφτει για πελάτες που πληρώνουν |
| Upload της οικιακής σύνδεσης | Περιορίζει το σερβίρισμα φωτογραφιών |
| Βλάβη NAS | Χάνεις υπηρεσία **και** δεδομένα ταυτόχρονα — τα offsite backups γίνονται υποχρεωτικά |
| Cloudflare Free | Όριο ανεβάσματος **100 MB** ανά αίτημα (η εφαρμογή έχει ήδη όριο 10 MB, οπότε δεν σε αγγίζει) |

---

## 4. Επιλογή B — Hetzner VPS + Caddy

Το `Caddy` είναι reverse proxy που βγάζει και **ανανεώνει μόνο του**
πιστοποιητικό Let's Encrypt. Καμία χειροκίνητη διαχείριση certificates.

```
Internet → Caddy (:443, TLS) → web:3000
```

### Βήμα 1 — Δημιουργία server

1. Λογαριασμός στο [hetzner.com/cloud](https://www.hetzner.com/cloud).
2. **New Project** → **Add Server**.
3. **Location:** Falkenstein / Nuremberg / Helsinki — **εντός ΕΕ**, σημαντικό
   για GDPR αφού αποθηκεύεις δεδομένα υγείας.
4. **Image:** Ubuntu 24.04
5. **Type:** `CX22` (2 vCPU x86, 4 GB RAM, 40 GB) — **~4,51 €/μήνα με ΦΠΑ**
   - Φθηνότερη εναλλακτική: `CAX11` (ARM, ~3,79 €). Δουλεύει, αλλά το image
     χτίζεται για `arm64` — λιγότερο δοκιμασμένο. Με 0,70 € διαφορά, πάρε το x86.
6. **SSH Key:** ανέβασε το δημόσιο κλειδί σου. **Μην** επιλέξεις κωδικό.
   - Αν δεν έχεις: `ssh-keygen -t ed25519 -C "nutreluma"` και ανέβασε το
     περιεχόμενο του `~/.ssh/id_ed25519.pub`.
7. **Firewalls:** φτιάξε ένα με inbound **22, 80, 443** μόνο.

### Βήμα 2 — DNS

Στον καταχωρητή ή στην Cloudflare, δύο εγγραφές προς την IP του server:

```
A     nutreluma.com        →  <IP_TOU_SERVER>
A     www.nutreluma.com    →  <IP_TOU_SERVER>
```

> Αν χρησιμοποιείς Cloudflare, βάλε το proxy σε **DNS only** (γκρι σύννεφο)
> μέχρι να βγει το πιστοποιητικό. Μετά μπορείς να το ενεργοποιήσεις.

Περίμενε να διαδοθεί: `dig +short nutreluma.com`

### Βήμα 3 — Βασική θωράκιση

```sh
ssh root@<IP_TOU_SERVER>

# Ενημερώσεις + αυτόματες ενημερώσεις ασφαλείας
apt update && apt upgrade -y
apt install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Απενεργοποίηση σύνδεσης με κωδικό (μόνο SSH key)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

> Πριν κλείσεις αυτό το terminal, **άνοιξε δεύτερο** και επιβεβαίωσε ότι
> συνδέεσαι. Αλλιώς κινδυνεύεις να κλειδωθείς έξω.

### Βήμα 4 — Docker

```sh
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

### Βήμα 5 — Swap (προαιρετικό στα 4 GB, υποχρεωτικό στα 2 GB)

```sh
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Βήμα 6 — Μεταφορά του project

Από τον **υπολογιστή σου** (όχι από τον server):

```sh
# Χωρίς node_modules, .next και .env — το .env το φτιάχνουμε καθαρό στον server
rsync -av --progress \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env*' \
  //tzoybe-nas/Container/nutreluma/ \
  root@<IP_TOU_SERVER>:/opt/nutreluma/
```

### Βήμα 7 — Caddy

Στον server, `/opt/nutreluma/Caddyfile`:

```
nutreluma.com, www.nutreluma.com {
	encode gzip zstd

	# Το Caddy τερματίζει το TLS και προωθεί σε καθαρό http μέσα στο
	# ιδιωτικό δίκτυο του Docker — δεν βγαίνει ποτέ εκτός host.
	reverse_proxy web:3000

	# HSTS: επιβάλλει https σε επόμενες επισκέψεις.
	header Strict-Transport-Security "max-age=31536000; includeSubDomains"

	# Το ανέβασμα φωτογραφιών έχει όριο 10 MB στην εφαρμογή· δίνουμε
	# λίγο περιθώριο για τα overheads του multipart.
	request_body {
		max_size 12MB
	}
}
```

Και `/opt/nutreluma/docker-compose.prod.yml`:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: nutreluma-caddy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data      # ΕΔΩ ζουν τα πιστοποιητικά — μη το σβήσεις
      - caddy_config:/config
    depends_on:
      web:
        condition: service_healthy

volumes:
  caddy_data:
  caddy_config:
```

Ο Caddy φτάνει την εφαρμογή ως `web:3000` μέσα από το δίκτυο του Docker, οπότε
η θύρα στο host δεν χρειάζεται καθόλου. Δέσ' την **μόνο στο loopback**, ώστε να
μην είναι προσβάσιμη απ' έξω ακόμη κι αν πέσει το firewall — στο `.env`:

```env
WEB_PORT=127.0.0.1:8095
```

> Το `docker-compose.yml` έχει `'${WEB_PORT:-3000}:3000'`, οπότε αυτό παράγει
> `127.0.0.1:8095:3000`. Λειτουργεί σε κάθε έκδοση του Compose — σε αντίθεση με
> το `ports: !override []`, που θέλει Compose 2.24+.

### Βήμα 8 — Ρυθμίσεις

```sh
cd /opt/nutreluma
cp .env.example .env
nano .env
```

Συμπλήρωσε **οπωσδήποτε**:

```env
NODE_ENV=production
APP_URL=https://nutreluma.com

POSTGRES_USER=nutreluma_user
POSTGRES_PASSWORD=<νέος ισχυρός κωδικός>
POSTGRES_DB=nutreluma_app
DATABASE_URL=postgresql://nutreluma_user:<ο ίδιος κωδικός>@db:5432/nutreluma_app

# Παράγωγέ το με:  openssl rand -base64 48
AUTH_SECRET=<τυχαία τιμή>

AI_PROVIDER=gemini
AI_API_KEY=<το κλειδί σου>
AI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gemini-3.6-flash

RUN_SEED=false
```

> **Αν κρατήσεις το ίδιο `AUTH_SECRET` με το NAS**, τα υπάρχοντα sessions
> παραμένουν έγκυρα. Αν βάλεις νέο, αποσυνδέονται όλοι — ακίνδυνο, απλώς
> ξανασυνδέονται.

### Βήμα 9 — Εκκίνηση

```sh
cd /opt/nutreluma
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Το πρώτο build παίρνει 5-10 λεπτά. Παρακολούθησε:

```sh
docker compose logs -f web
```

### Βήμα 10 — Επαλήθευση

```sh
# Πιστοποιητικό
curl -sI https://nutreluma.com/api/health

# Ανακατεύθυνση http → https (το κάνει μόνο του το Caddy)
curl -sI http://nutreluma.com | head -3

# Το πιστοποιητικό εκδόθηκε;
docker logs nutreluma-caddy 2>&1 | grep -i "certificate obtained"
```

---

## 5. Μεταφορά δεδομένων από το NAS στο VPS

**Μόνο για την Επιλογή B.** Κάν' το αφού σηκωθεί ο νέος server και **πριν**
αλλάξεις το DNS σε παραγωγή, ή σε ώρα χαμηλής κίνησης.

### 5.1 Πάρε αντίγραφο από το NAS

```sh
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
cd /share/Container/nutreluma

# Βάση δεδομένων
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  < /dev/null > /share/Container/nutreluma-db.sql

# Εικόνες γευμάτων
docker run --rm \
  -v nutreluma_uploads_data:/data:ro \
  -v /share/Container:/backup \
  alpine tar czf /backup/nutreluma-uploads.tar.gz -C /data .

ls -lh /share/Container/nutreluma-db.sql /share/Container/nutreluma-uploads.tar.gz
```

### 5.2 Στείλ' τα στον server

Από τον υπολογιστή σου:

```sh
scp //tzoybe-nas/Container/nutreluma-db.sql        root@<IP>:/opt/nutreluma/
scp //tzoybe-nas/Container/nutreluma-uploads.tar.gz root@<IP>:/opt/nutreluma/
```

### 5.3 Επαναφορά στον server

```sh
cd /opt/nutreluma

# Οι πίνακες υπάρχουν ήδη από τα migrations. Καθαρίζουμε ώστε το
# restore να μη σκοντάψει σε διπλά κλειδιά.
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' < /dev/null

# Επαναφορά
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < nutreluma-db.sql

# Εικόνες
docker run --rm \
  -v nutreluma_uploads_data:/data \
  -v /opt/nutreluma:/backup \
  alpine sh -c "tar xzf /backup/nutreluma-uploads.tar.gz -C /data"

# Επανεκκίνηση ώστε το Prisma να δει καθαρή κατάσταση
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart web
```

### 5.4 Επαλήθευση ότι δεν χάθηκε τίποτα

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT (SELECT count(*) FROM users)         AS xristes,
       (SELECT count(*) FROM meals)         AS gevmata,
       (SELECT coalesce(sum(\"finalCalories\"),0) FROM meals) AS kcal,
       (SELECT count(*) FROM subscriptions) AS sindromes;"' < /dev/null
```

**Σύγκρινε τους αριθμούς με το NAS πριν προχωρήσεις.** Πρέπει να είναι
πανομοιότυποι.

### 5.5 Καθάρισμα

```sh
rm -f /opt/nutreluma/nutreluma-db.sql /opt/nutreluma/nutreluma-uploads.tar.gz
```

Τα αντίγραφα περιέχουν κατακερματισμένους κωδικούς και προσωπικά δεδομένα
υγείας — μην τα αφήσεις να μένουν.

---

## 6. Αντίγραφα ασφαλείας

Απαραίτητα και στις δύο επιλογές. Το script κρατά τα τελευταία 14 αντίγραφα.

Φτιάξε το `/opt/nutreluma/backup.sh` *(στο NAS: `/share/Container/nutreluma/backup.sh`)*:

```sh
#!/bin/sh
# Αντίγραφο βάσης και εικόνων. Κρατά τα 14 τελευταία.
set -e

DIR=/opt/nutreluma/backups
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "$DIR"
cd /opt/nutreluma

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  < /dev/null | gzip > "$DIR/db-$STAMP.sql.gz"

docker run --rm \
  -v nutreluma_uploads_data:/data:ro \
  -v "$DIR":/backup \
  alpine tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .

# Διαγραφή παλαιότερων
ls -1t "$DIR"/db-*.sql.gz      | tail -n +15 | xargs -r rm --
ls -1t "$DIR"/uploads-*.tar.gz | tail -n +15 | xargs -r rm --

echo "$(date -Iseconds) backup ok: $STAMP"
```

```sh
chmod +x /opt/nutreluma/backup.sh

# Καθημερινά στις 03:30
( crontab -l 2>/dev/null; echo "30 3 * * * /opt/nutreluma/backup.sh >> /var/log/nutreluma-backup.log 2>&1" ) | crontab -
```

### Offsite αντίγραφο (σημαντικό)

Backup που ζει **μόνο** στον ίδιο server δεν είναι backup. Αν επιλέξεις το
VPS, στείλε τα αντίγραφα στο NAS σου — έτσι το NAS αποκτά τον σωστό του ρόλο:

```sh
# Στον server, με SSH key προς το NAS
rsync -az --delete /opt/nutreluma/backups/ \
  TzoyBe@<IP_TOU_NAS>:/share/Container/cv-backups/
```

> **Δοκίμασε μια επαναφορά** τουλάχιστον μία φορά. Αντίγραφο που δεν έχει
> δοκιμαστεί δεν είναι αντίγραφο — είναι ελπίδα.

---

## 7. Τι ξεκλειδώνεται μόλις υπάρχει δημόσιο URL

Και οι δύο επιλογές το επιτρέπουν:

| Δυνατότητα | Γιατί τώρα γίνεται |
|---|---|
| **Webhooks Stripe / PayPal** | Οι πάροχοι μπορούν να μας ειδοποιούν. Ο κώδικας είναι έτοιμος: το `reconcileSubscription()` σχεδιάστηκε να καλείται από webhook route χωρίς άλλη αλλαγή. Θα αντικαταστήσει το polling των 5 λεπτών. |
| **Ανάκτηση κωδικού** | Χρειάζεται δημόσιο URL για τον σύνδεσμο επαναφοράς **και** αποστολή email. Δες παρακάτω. |
| **PWA / εγκατάσταση στο κινητό** | Τα service workers απαιτούν HTTPS. |

### Email — μην στήσεις δικό σου mail server

Είναι ο κλασικός τρόπος να χαθεί ένα σαββατοκύριακο και τα emails να
καταλήγουν στα ανεπιθύμητα:

- Οι IP των VPS και των οικιακών συνδέσεων είναι **προεπιλεγμένα σε
  blocklists**. Gmail και Outlook θα σε πετάνε στα spam ή θα σε απορρίπτουν.
- Θέλει σωστό SPF, DKIM, DMARC και **reverse DNS (PTR)** — και συνεχή
  παρακολούθηση της φήμης της IP.
- Η **Hetzner κλείνει τη θύρα 25** σε νέους λογαριασμούς εξ ορισμού.
- Από το 2024, Google και Yahoo επιβάλλουν αυστηρότερους κανόνες σε αποστολείς.

**Χρησιμοποίησε SMTP relay.** Δωρεάν επίπεδα που καλύπτουν άνετα την κλίμακά σου:

| Υπηρεσία | Δωρεάν | Σημείωση |
|---|---|---|
| **Brevo** | 300 email/ημέρα | Γαλλική, δεδομένα σε ΕΕ |
| **Resend** | 3.000/μήνα | Πολύ καλό developer experience, επιλογή περιοχής ΕΕ |
| **Mailgun EU** | περιορισμένο | Ρητά ΕΕ endpoints |
| **Amazon SES** | ~0,10 $ / 1.000 | Φθηνότερο σε κλίμακα, `eu-central-1` |

Χρειάζεσαι μόνο SMTP στοιχεία και επαλήθευση του domain (μία εγγραφή TXT).

> **Η ανάκτηση κωδικού δεν υπάρχει ακόμη στην εφαρμογή.** Σήμερα, όποιος
> ξεχάσει τον κωδικό του κλειδώνεται μόνιμα έξω — και αν είναι συνδρομητής,
> γίνεται αίτημα επιστροφής χρημάτων. Είναι το επόμενο πράγμα που αξίζει να
> υλοποιηθεί μετά τη μετάβαση.

---

## 8. Επιστροφή σε προηγούμενη κατάσταση

### Επιλογή A

```sh
cd /share/Container/nutreluma
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml down
sed -i 's|^APP_URL=.*|APP_URL=http://192.168.2.249:8095|' .env
docker compose --env-file .env up -d
```

### Επιλογή B

Το NAS παραμένει ανέπαφο σε όλη τη διαδικασία. Για επιστροφή, γύρνα το DNS
πίσω ή απλώς χρησιμοποίησε ξανά την τοπική διεύθυνση. **Μη σβήσεις τίποτα από
το NAS** πριν περάσουν δύο εβδομάδες ομαλής λειτουργίας στο VPS.

---

## Γρήγορη σύγκριση

| | **A — NAS + Tunnel** | **B — Hetzner VPS** |
|---|---|---|
| Κόστος/μήνα | **0 €** | ~4,50 € |
| Χρόνος στησίματος | ~30 λεπτά | ~90 λεπτά |
| HTTPS | ✅ αυτόματο | ✅ αυτόματο |
| Uptime | εξαρτάται από ρεύμα/ίντερνετ σπιτιού | ~99,9 % |
| Ταχύτητα σερβιρίσματος | όσο το upload σου | 1 Gbit |
| Τα δεδομένα ζουν | σπίτι σου | Γερμανία/Φινλανδία (ΕΕ) |
| Κίνδυνος | βλάβη NAS = χάνεις υπηρεσία **και** δεδομένα | χρειάζεται δικά σου backups |
| Συντήρηση | ελάχιστη | ενημερώσεις συστήματος |

**Πρόταση:** ξεκίνα με το **A** σήμερα — δωρεάν, μισή ώρα, και έχεις αμέσως
HTTPS ώστε να δουλέψουν Stripe και PayPal. Πέρνα στο **B** όταν αποκτήσεις
πελάτες που πληρώνουν και το uptime αρχίσει να μετράει. Η μετάβαση A → B είναι
ακριβώς η ενότητα 5 και δεν πετάς τίποτα από τη δουλειά που έκανες.
