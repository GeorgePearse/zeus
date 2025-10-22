import type { Argv } from "yargs"
import { Bus } from "../../bus"
import { Provider } from "../../provider/provider"
import { Session } from "../../session"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { Flag } from "../../flag/flag"
import { Config } from "../../config/config"
import { bootstrap } from "../bootstrap"
import { MessageV2 } from "../../session/message-v2"
import { Identifier } from "../../id/id"
import { Agent } from "../../agent/agent"
import { Command } from "../../command"
import { SessionPrompt } from "../../session/prompt"
import { extractStrategyConfig, hasStrategyFlags } from "../../strategy/cli"

const TOOL: Record<string, [string, string]> = {
  todowrite: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  todoread: ["Todo", UI.Style.TEXT_WARNING_BOLD],
  bash: ["Bash", UI.Style.TEXT_DANGER_BOLD],
  edit: ["Edit", UI.Style.TEXT_SUCCESS_BOLD],
  glob: ["Glob", UI.Style.TEXT_INFO_BOLD],
  grep: ["Grep", UI.Style.TEXT_INFO_BOLD],
  list: ["List", UI.Style.TEXT_INFO_BOLD],
  read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD],
  write: ["Write", UI.Style.TEXT_SUCCESS_BOLD],
  websearch: ["Search", UI.Style.TEXT_DIM_BOLD],
}

export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run zeus with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "the command to run, use message for args",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("share", {
        type: "boolean",
        describe: "share the session",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (raw JSON events)",
      })
      .option("list-strategies", {
        type: "boolean",
        describe: "list all available strategies and exit",
      })
      // Strategy flags - OptiLLM integration
      .option("strategy-chain", {
        type: "string",
        describe: "chain of strategies to apply (comma-separated)",
      })
      .option("mars", {
        type: "boolean",
        describe: "use MARS (Multi-agent reasoning)",
      })
      .option("cepo", {
        type: "boolean",
        describe: "use CePO (Combined Enhanced Prompt Optimization)",
      })
      .option("cot-reflection", {
        type: "boolean",
        describe: "use Chain of Thought with Reflection",
      })
      .option("plansearch", {
        type: "boolean",
        describe: "use PlanSearch algorithm",
      })
      .option("re2", {
        type: "boolean",
        describe: "use RE2 (ReRead - process queries twice)",
      })
      .option("self-consistency", {
        type: "boolean",
        describe: "use Self-Consistency (multiple reasoning paths)",
      })
      .option("z3", {
        type: "boolean",
        describe: "use Z3 theorem proving",
      })
      .option("rstar", {
        type: "boolean",
        describe: "use R* algorithm",
      })
      .option("leap", {
        type: "boolean",
        describe: "use LEAP (learn from few-shot examples)",
      })
      .option("rto", {
        type: "boolean",
        describe: "use Round Trip Optimization",
      })
      .option("bon", {
        type: "boolean",
        describe: "use Best of N sampling",
      })
      .option("moa", {
        type: "boolean",
        describe: "use Mixture of Agents",
      })
      .option("mcts", {
        type: "boolean",
        describe: "use Monte Carlo Tree Search",
      })
      .option("pvg", {
        type: "boolean",
        describe: "use Prover-Verifier Game",
      })
      .option("deep-confidence", {
        type: "boolean",
        describe: "use Deep Confidence guided reasoning",
      })
      .option("cot-decoding", {
        type: "boolean",
        describe: "use CoT Decoding (without explicit prompting)",
      })
      .option("entropy-decoding", {
        type: "boolean",
        describe: "use Entropy Decoding (adaptive sampling)",
      })
      .option("think-deeper", {
        type: "boolean",
        describe: "use ThinkDeeper (reasoning effort)",
      })
      .option("auto-think", {
        type: "boolean",
        describe: "use AutoThink (auto complexity classification)",
      })
      // Strategy aliases
      .option("reasoning", {
        type: "boolean",
        describe: "alias for --cot-reflection",
      })
      .option("ultrathink", {
        type: "boolean",
        describe: "alias for --think-deeper",
      })
  },
  handler: async (args) => {
    // Handle --list-strategies flag early (before message validation)
    if (args.listStrategies) {
      await bootstrap(process.cwd(), async () => {
        const { strategyRegistry } = await import("../../strategy/strategy")
        const strategies = strategyRegistry.getAll()

        UI.println(UI.Style.TEXT_INFO_BOLD + "Available Strategies:\n")

        for (const [name, strategy] of Object.entries(strategies)) {
          const meta = strategy.metadata
          const aliasText = meta.aliases.length > 0 ? ` (aliases: ${meta.aliases.join(", ")})` : ""
          const costText = meta.estimatedCostMultiplier > 1 ? ` [${meta.estimatedCostMultiplier}x cost]` : ""
          const streamText = !meta.supportsStreaming ? " [no streaming]" : ""

          UI.println(UI.Style.TEXT_SUCCESS_BOLD + `  --${name}${aliasText}`)
          UI.println(UI.Style.TEXT_DIM + `    ${meta.description}`)
          UI.println(
            UI.Style.TEXT_DIM +
              `    Category: ${meta.category}${costText}${streamText}${meta.requiresMultipleCalls ? " [multiple calls]" : ""}`,
          )
          UI.println()
        }
      })
      process.exit(0)
    }

    let message = args.message.join(" ")

    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text())

    if (message.trim().length === 0 && !args.command) {
      UI.error("You must provide a message or a command")
      process.exit(1)
    }

    await bootstrap(process.cwd(), async () => {

      if (args.command) {
        const exists = await Command.get(args.command)
        if (!exists) {
          UI.error(`Command "${args.command}" not found`)
          process.exit(1)
        }
      }
      const session = await (async () => {
        if (args.continue) {
          const it = Session.list()
          try {
            for await (const s of it) {
              if (s.parentID === undefined) {
                return s
              }
            }
            return
          } finally {
            await it.return()
          }
        }

        if (args.session) return Session.get(args.session)

        return Session.create({})
      })()

      if (!session) {
        UI.error("Session not found")
        process.exit(1)
      }

      const cfg = await Config.get()
      if (cfg.share === "auto" || Flag.ZEUS_AUTO_SHARE || args.share) {
        try {
          await Session.share(session.id)
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  https://zeus.ai/s/" + session.id.slice(-8))
        } catch (error) {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          } else {
            throw error
          }
        }
      }

      const agent = await (async () => {
        if (args.agent) return Agent.get(args.agent)
        const build = Agent.get("build")
        if (build) return build
        return Agent.list().then((x) => x[0])
      })()

      const { providerID, modelID } = await (async () => {
        if (args.model) return Provider.parseModel(args.model)
        if (agent.model) return agent.model
        return await Provider.defaultModel()
      })()

      function printEvent(color: string, type: string, title: string) {
        UI.println(
          color + `|`,
          UI.Style.TEXT_NORMAL + UI.Style.TEXT_DIM + ` ${type.padEnd(7, " ")}`,
          "",
          UI.Style.TEXT_NORMAL + title,
        )
      }

      function outputJsonEvent(type: string, data: any) {
        if (args.format === "json") {
          const jsonEvent = {
            type,
            timestamp: Date.now(),
            sessionID: session?.id,
            ...data,
          }
          process.stdout.write(JSON.stringify(jsonEvent) + "\n")
          return true
        }
        return false
      }

      let text = ""
      const messageID = Identifier.ascending("message")

      Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        if (evt.properties.part.sessionID !== session.id) return
        if (evt.properties.part.messageID === messageID) return
        const part = evt.properties.part

        if (part.type === "tool" && part.state.status === "completed") {
          if (outputJsonEvent("tool_use", { part })) return
          const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]
          const title =
            part.state.title ||
            (Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "Unknown")

          printEvent(color, tool, title)

          if (part.tool === "bash" && part.state.output && part.state.output.trim()) {
            UI.println()
            UI.println(part.state.output)
          }
        }

        if (part.type === "step-start") {
          if (outputJsonEvent("step_start", { part })) return
        }

        if (part.type === "step-finish") {
          if (outputJsonEvent("step_finish", { part })) return
        }

        if (part.type === "text") {
          text = part.text

          if (part.time?.end) {
            if (outputJsonEvent("text", { part })) return
            UI.empty()
            UI.println(UI.markdown(text))
            UI.empty()
            text = ""
            return
          }
        }
      })

      let errorMsg: string | undefined
      Bus.subscribe(Session.Event.Error, async (evt) => {
        const { sessionID, error } = evt.properties
        if (sessionID !== session.id || !error) return
        let err = String(error.name)

        if ("data" in error && error.data && "message" in error.data) {
          err = error.data.message
        }
        errorMsg = errorMsg ? errorMsg + "\n" + err : err

        if (outputJsonEvent("error", { error })) return
        UI.error(err)
      })

      const result = await (async () => {
        if (args.command) {
          return await SessionPrompt.command({
            messageID,
            sessionID: session.id,
            agent: agent.name,
            model: providerID + "/" + modelID,
            command: args.command,
            arguments: message,
          })
        }

        // Extract strategy configuration from CLI args
        const strategyConfig = hasStrategyFlags(args) ? extractStrategyConfig(args) ?? undefined : undefined

        return await SessionPrompt.prompt({
          sessionID: session.id,
          messageID,
          model: {
            providerID,
            modelID,
          },
          agent: agent.name,
          strategyConfig,
          parts: [
            {
              id: Identifier.ascending("part"),
              type: "text",
              text: message,
            },
          ],
        })
      })()

      const isPiped = !process.stdout.isTTY
      if (isPiped) {
        const match = result.parts.findLast((x: any) => x.type === "text") as any
        if (outputJsonEvent("text", { text: match })) return
        if (match) process.stdout.write(UI.markdown(match.text))
        if (errorMsg) process.stdout.write(errorMsg)
      }
      UI.empty()
      if (errorMsg) process.exit(1)
    })
  },
})
