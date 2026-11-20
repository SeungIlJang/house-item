// 웹 버전을 빌드하고, 같은 빌드로 앱용 OTA 묶음(zip)과 안내 파일(manifest.json)을 dist/ota 에 만든다.
// `npm run deploy:web` 이 이 스크립트를 실행한 뒤 dist 전체를 올린다.
//
//   dist/ota/manifest.json            앱이 확인하는 파일 { version, builtAt, url, minNativeBuild }
//   dist/ota/bundle-<version>.zip     앱이 내려받는 웹 묶음 (dist 내용, ota 폴더 제외)
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const config = JSON.parse(readFileSync(join(root, 'ota.config.json'), 'utf8'))

// 버전: 패키지 버전 + 빌드 시각. builtAt 으로 "더 새 묶음인지"를 비교한다.
const builtAt = Date.now()
const stamp = new Date(builtAt).toISOString().replace(/[-:T]/g, '').slice(0, 14)
const version = `${pkg.version}-${stamp}`

// 출시용 광고 ID 가 없으면 이 묶음을 받은 앱에 테스트 광고가 나온다.
const envFile = join(root, '.env.production')
const hasAdId = Boolean(process.env.VITE_ADMOB_BANNER_ID) || (existsSync(envFile) && /^VITE_ADMOB_BANNER_ID=\S+/m.test(readFileSync(envFile, 'utf8')))
if (!hasAdId) console.warn('⚠️  VITE_ADMOB_BANNER_ID 가 없습니다. 이 묶음을 받은 앱에는 구글 테스트 광고가 나옵니다 (.env.production 에 넣으세요).')

console.log(`▶ 빌드 ${version}`)
execSync('npm run build', { cwd: root, stdio: 'inherit', env: { ...process.env, APP_BUILD_ID: version, APP_BUILT_AT: String(builtAt) } })

const dist = join(root, 'dist')
const otaDir = join(dist, 'ota')
mkdirSync(otaDir, { recursive: true })

const zip = new AdmZip()
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (full === otaDir) continue
    if (statSync(full).isDirectory()) walk(full)
    // zip 안 경로는 항상 / 로 쓴다(윈도우의 \ 가 들어가면 기기에서 파일을 못 찾는다).
    else zip.addFile(relative(dist, full).split('\\').join('/'), readFileSync(full))
  }
}
walk(dist)
if (!zip.getEntry('index.html')) throw new Error('묶음 맨 위에 index.html 이 없습니다.')

const zipName = `bundle-${version}.zip`
zip.writeZip(join(otaDir, zipName))

const manifest = {
  version,
  builtAt,
  url: `${config.publicBaseUrl.replace(/\/$/, '')}/ota/${zipName}`,
  minNativeBuild: config.minNativeBuild,
}
writeFileSync(join(otaDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const sizeKb = Math.round(statSync(join(otaDir, zipName)).size / 1024)
console.log(`✓ OTA 묶음 ${zipName} (${sizeKb}KB, 파일 ${zip.getEntries().length}개)`)
console.log(`✓ manifest: ${JSON.stringify(manifest)}`)
