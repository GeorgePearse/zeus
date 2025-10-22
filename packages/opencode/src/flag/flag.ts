export namespace Flag {
  export const ZEUS_AUTO_SHARE = truthy("ZEUS_AUTO_SHARE")
  export const ZEUS_CONFIG = process.env["ZEUS_CONFIG"]
  export const ZEUS_CONFIG_CONTENT = process.env["ZEUS_CONFIG_CONTENT"]
  export const ZEUS_DISABLE_AUTOUPDATE = truthy("ZEUS_DISABLE_AUTOUPDATE")
  export const ZEUS_DISABLE_PRUNE = truthy("ZEUS_DISABLE_PRUNE")
  export const ZEUS_PERMISSION = process.env["ZEUS_PERMISSION"]
  export const ZEUS_DISABLE_DEFAULT_PLUGINS = truthy("ZEUS_DISABLE_DEFAULT_PLUGINS")
  export const ZEUS_DISABLE_LSP_DOWNLOAD = truthy("ZEUS_DISABLE_LSP_DOWNLOAD")
  export const ZEUS_ENABLE_EXPERIMENTAL_MODELS = truthy("ZEUS_ENABLE_EXPERIMENTAL_MODELS")
  export const ZEUS_DISABLE_AUTOCOMPACT = truthy("ZEUS_DISABLE_AUTOCOMPACT")

  // Experimental
  export const ZEUS_EXPERIMENTAL_WATCHER = truthy("ZEUS_EXPERIMENTAL_WATCHER")
  export const ZEUS_EXPERIMENTAL_NO_BOOTSTRAP = truthy("ZEUS_EXPERIMENTAL_NO_BOOTSTRAP")

  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }
}
