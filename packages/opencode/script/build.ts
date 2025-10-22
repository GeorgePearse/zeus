#!/usr/bin/env bun
import path from "path"
const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)
import { $ } from "bun"

import pkg from "../package.json"
import { Script } from "@zeus-ai/script"

const GOARCH: Record<string, string> = {
  arm64: "arm64",
  x64: "amd64",
  "x64-baseline": "amd64",
}

const targets = [
  ["windows", "x64"],
  ["linux", "arm64"],
  ["linux", "x64"],
  ["linux", "x64-baseline"],
  ["darwin", "x64"],
  ["darwin", "x64-baseline"],
  ["darwin", "arm64"],
]

await $`rm -rf dist`

const binaries: Record<string, string> = {}
for (const [os, arch] of targets) {
  console.log(`building ${os}-${arch}`)
  const name = `${pkg.name}-${os}-${arch}`
  await $`mkdir -p dist/${name}/bin`
  await $`CGO_ENABLED=0 GOOS=${os} GOARCH=${GOARCH[arch]} go build -ldflags="-s -w -X main.Version=${Script.version}" -o ../zeus/dist/${name}/bin/tui ../tui/cmd/zeus/main.go`
    .cwd("../tui")
    .quiet()

  const watcher = `@parcel/watcher-${os === "windows" ? "win32" : os}-${arch.replace("-baseline", "")}${os === "linux" ? "-glibc" : ""}`
  await $`mkdir -p ../../node_modules/${watcher}`
  await $`npm pack npm pack ${watcher}`.cwd(path.join(dir, "../../node_modules")).quiet()
  await $`tar -xf ../../node_modules/${watcher.replace("@parcel/", "parcel-")}-*.tgz -C ../../node_modules/${watcher} --strip-components=1`

  await Bun.build({
    compile: {
      target: `bun-${os}-${arch}` as any,
      outfile: `dist/${name}/bin/zeus`,
      execArgv: [`--user-agent=zeus/${Script.version}`, `--env-file=""`, `--`],
      windows: {},
    },
    entrypoints: ["./src/index.ts"],
    define: {
      ZEUS_VERSION: `'${Script.version}'`,
      ZEUS_CHANNEL: `'${Script.channel}'`,
      ZEUS_TUI_PATH: `'../../../dist/${name}/bin/tui'`,
    },
  })
  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        os: [os === "windows" ? "win32" : os],
        cpu: [arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

export { binaries }
