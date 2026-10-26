// Genera las claves VAPID y crea server/.env si no existe.
import webpush from 'web-push'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
const keys = webpush.generateVAPIDKeys()

if (existsSync(envPath)) {
  console.log('Ya existe .env; claves nuevas por si las quieres rotar:')
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
} else {
  writeFileSync(
    envPath,
    `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:https://tu-app.workers.dev\nPORT=8787\n`,
  )
  console.log('server/.env creado con claves VAPID nuevas.')
}
