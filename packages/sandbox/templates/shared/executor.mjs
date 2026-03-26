#!/usr/bin/env node

// src/executor.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs3 from "fs";
import * as path from "path";

// src/utils/download-image.ts
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
async function downloadImage(url, destPath) {
  return new Promise((resolve2, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadImage(redirectUrl, destPath).then(resolve2).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve2(destPath);
      });
    }).on("error", (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// src/utils/env-loader.ts
import * as fs2 from "fs";
function loadEnvFile(envPath) {
  try {
    if (fs2.existsSync(envPath)) {
      const envContent = fs2.readFileSync(envPath, "utf8");
      const envLines = envContent.split("\n");
      for (const line of envLines) {
        if (line.trim() && !line.startsWith("#")) {
          const [key, ...valueParts] = line.split("=");
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join("=").trim();
          }
        }
      }
    }
  } catch (err) {
    console.log("Could not load .env file:", err.message);
  }
}

// src/slim-message.ts
function slimifyMessage(message) {
  switch (message.type) {
    case "system": {
      if (message.subtype === "init") {
        return [{
          type: "system",
          subtype: "init",
          model: message.model ?? "",
          cwd: message.cwd ?? "",
          tools: message.tools ?? [],
          session_id: message.session_id ?? ""
        }];
      }
      return [];
    }
    case "assistant": {
      const msg = message;
      const contentBlocks = msg.message?.content ?? msg.content ?? [];
      const results = [];
      for (const block of contentBlocks) {
        if (block.type === "text" && block.text) {
          results.push({
            type: "assistant",
            subtype: "text",
            text: block.text
          });
        } else if (block.type === "tool_use") {
          const toolName = block.name ?? "";
          const input = block.input ?? {};
          if (toolName === "TodoWrite") {
            results.push({
              type: "assistant",
              subtype: "tool_use",
              tool_name: toolName,
              input
            });
            continue;
          }
          const slim = {
            type: "assistant",
            subtype: "tool_use",
            tool_name: toolName
          };
          if (toolName === "Write" || toolName === "Edit" || toolName === "Read") {
            slim.file_path = input.file_path ?? void 0;
          } else if (toolName === "Glob") {
            slim.pattern = input.pattern ?? void 0;
          } else if (toolName === "Grep") {
            slim.pattern = input.pattern ?? void 0;
          } else if (toolName === "Bash") {
            const cmd = input.command ?? input.description ?? "";
            slim.command_preview = typeof cmd === "string" ? cmd.slice(0, 100) : "";
          }
          results.push(slim);
        }
      }
      return results;
    }
    case "user": {
      const msg = message;
      const contentBlocks = msg.message?.content ?? msg.content ?? [];
      let success = true;
      for (const block of contentBlocks) {
        if (block.is_error || block.type === "tool_result" && block.is_error) {
          success = false;
          break;
        }
        if (typeof block.content === "string" && block.content.startsWith("Error:")) {
          success = false;
          break;
        }
      }
      return [{
        type: "user",
        subtype: "tool_result",
        success
      }];
    }
    case "tool_progress": {
      return [message];
    }
    case "result": {
      const msg = message;
      const slim = {
        type: "result",
        subtype: msg.subtype ?? "unknown",
        is_error: msg.is_error ?? msg.subtype !== "success",
        duration_ms: msg.duration_ms,
        total_cost_usd: msg.total_cost_usd,
        session_id: msg.session_id
      };
      if (typeof msg.result === "string") {
        slim.result = msg.result;
      }
      if (Array.isArray(msg.errors) && msg.errors.length > 0) {
        slim.errors = msg.errors;
      }
      return [slim];
    }
    // Skip these message types entirely — not used by frontend
    case "stream_event":
    case "compact_boundary":
    case "hook_response":
    case "auth_status":
    case "status":
      return [];
    default:
      return [];
  }
}

// src/executor.ts
var DEFAULT_CONFIG = {
  defaultCwd: "/home/user/app",
  envPath: "/claude-sdk/.env",
  imagesDir: "/tmp/attached-images",
  heartbeatInterval: 3e4
};
async function runExecutor(args, config, hooks) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cwd = args.cwd || cfg.defaultCwd;
  console.log("========================================");
  console.log("CAPSULE AGENT STARTING");
  console.log("========================================");
  console.log("Version: agent-package-v1");
  loadEnvFile(cfg.envPath);
  console.log("Environment check:");
  console.log("- Working directory:", cwd);
  console.log("- ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
  console.log("- ANTHROPIC_API_KEY length:", process.env.ANTHROPIC_API_KEY?.length || 0);
  try {
    const fullPath = path.resolve(cwd);
    if (!fs3.existsSync(fullPath)) {
      console.log("Creating directory:", fullPath);
      fs3.mkdirSync(fullPath, { recursive: true });
    }
    console.log("Directory exists and is accessible:", fullPath);
  } catch (err) {
    console.error("Directory check failed:", err);
  }
  const messages = [];
  const heartbeatInterval = setInterval(() => {
    console.log("Streaming: [Heartbeat - Agent is working...]");
  }, cfg.heartbeatInterval);
  try {
    console.log("Starting Claude Code query...");
    console.log("Streaming: Initializing AI Code Agent...");
    let finalPrompt = args.prompt;
    const downloadedImagePaths = [];
    if (args.imageUrls && args.imageUrls.length > 0) {
      console.log("========================================");
      console.log("DOWNLOADING IMAGES TO LOCAL FILES");
      console.log("========================================");
      console.log("Streaming: Processing request with", args.imageUrls.length, "attached images...");
      if (!fs3.existsSync(cfg.imagesDir)) {
        fs3.mkdirSync(cfg.imagesDir, { recursive: true });
      }
      for (let i = 0; i < args.imageUrls.length; i++) {
        const url = args.imageUrls[i];
        if (!url) continue;
        const urlPath = new URL(url).pathname;
        const ext = path.extname(urlPath) || ".png";
        const filename = `image-${i + 1}${ext}`;
        const destPath = path.join(cfg.imagesDir, filename);
        console.log(`Downloading image ${i + 1}/${args.imageUrls.length}: ${url.substring(0, 80)}...`);
        try {
          await downloadImage(url, destPath);
          downloadedImagePaths.push(destPath);
          console.log(`Image ${i + 1} saved to: ${destPath}`);
        } catch (err) {
          console.error(`Failed to download image ${i + 1}:`, err);
        }
      }
      if (downloadedImagePaths.length > 0) {
        const imageInstructions = downloadedImagePaths.map((imgPath, i) => `- Image ${i + 1}: ${imgPath}`).join("\n");
        finalPrompt = `The user has attached ${downloadedImagePaths.length} image(s) for reference. Please read and analyze these images to understand the context:
${imageInstructions}

User request:
${args.prompt}`;
        console.log("Added", downloadedImagePaths.length, "image file references to prompt");
      } else {
        console.log("No images were successfully downloaded, proceeding with text-only prompt");
      }
    }
    const hooksConfig = {};
    if (hooks?.onSessionEnd && hooks.onSessionEnd.length > 0) {
      hooksConfig["SessionEnd"] = [{ hooks: hooks.onSessionEnd }];
    }
    if (hooks?.onPostToolUse && hooks.onPostToolUse.length > 0) {
      hooksConfig["PostToolUse"] = [{ matcher: "Write|Edit", hooks: hooks.onPostToolUse }];
    }
    const systemPromptOption = args.systemPrompt ? {
      type: "preset",
      preset: "claude_code",
      append: args.systemPrompt
    } : void 0;
    if (args.systemPrompt) {
      console.log("System prompt loaded, length:", args.systemPrompt.length);
    } else {
      console.log("WARNING: No system prompt provided \u2014 agent will use default behavior");
    }
    if (args.sessionId) {
      console.log("Resuming session:", args.sessionId);
    }
    const baseOptions = {
      cwd,
      permissionMode: "bypassPermissions",
      // Load skills from filesystem - required for Agent Skills to work
      settingSources: ["user", "project"],
      // Pass system prompt so agent knows it's a React Native/Expo builder
      ...systemPromptOption && { systemPrompt: systemPromptOption },
      // Pass model selection if provided
      ...args.model && { model: args.model },
      // Add hooks if configured
      ...Object.keys(hooksConfig).length > 0 && { hooks: hooksConfig }
    };
    let useResume = !!args.sessionId;
    let taskFailed = false;
    const runQuery = async (withResume) => {
      const options = withResume ? { ...baseOptions, resume: args.sessionId } : baseOptions;
      for await (const message of query({
        prompt: finalPrompt,
        options
      })) {
        messages.push(message);
        const slimMessages = slimifyMessage(message);
        for (const slim of slimMessages) {
          console.log(`Streaming: ${JSON.stringify(slim)}`);
        }
        if (message.type === "result") {
          if (message.subtype === "success") {
            console.log(`Streaming: Task completed successfully`);
            console.log(`Streaming: Cost: $${message.total_cost_usd.toFixed(4)}, Duration: ${(message.duration_ms / 1e3).toFixed(2)}s`);
          } else {
            const errors = message.errors || [];
            console.log(`Streaming: Task failed: ${message.subtype}`);
            console.log(`Streaming: Task failed errors: ${JSON.stringify(errors)}`);
            console.log(`Streaming: Task failed stop_reason: ${message.stop_reason}`);
            taskFailed = true;
          }
        }
      }
    };
    try {
      await runQuery(useResume);
    } catch (resumeError) {
      if (useResume) {
        console.warn("Resume failed, retrying without resume:", resumeError instanceof Error ? resumeError.message : String(resumeError));
        console.log("Streaming: Session resume failed, starting fresh session...");
        messages.length = 0;
        taskFailed = false;
        await runQuery(false);
      } else {
        throw resumeError;
      }
    }
    if (taskFailed && useResume) {
      console.warn("Task failed with resume, retrying without resume...");
      console.log("Streaming: Retrying without session resume...");
      messages.length = 0;
      taskFailed = false;
      await runQuery(false);
    }
    console.log("Query completed successfully");
    console.log("CLAUDE_CODE_COMPLETE");
    console.log(JSON.stringify({ success: true, messages }, null, 2));
    return { success: true, messages };
  } catch (error) {
    console.error("Error occurred:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ success: false, error: errorMessage }, null, 2));
    return { success: false, messages, error: errorMessage };
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// src/utils/parse-args.ts
import * as fs4 from "fs";
function parseArgs(argv) {
  const args = argv.slice(2);
  const promptArg = args.find((arg) => arg.startsWith("--prompt="));
  const systemPromptArg = args.find((arg) => arg.startsWith("--system-prompt="));
  const systemPromptFileArg = args.find((arg) => arg.startsWith("--system-prompt-file="));
  const cwdArg = args.find((arg) => arg.startsWith("--cwd="));
  const modelArg = args.find((arg) => arg.startsWith("--model="));
  const imageUrlsArg = args.find((arg) => arg.startsWith("--image-urls="));
  const continueArg = args.find((arg) => arg.startsWith("--continue="));
  if (!promptArg) {
    throw new Error("--prompt argument is required");
  }
  const prompt = promptArg.substring("--prompt=".length);
  const cwd = cwdArg?.substring("--cwd=".length);
  const model = modelArg?.substring("--model=".length);
  let systemPrompt;
  if (systemPromptFileArg) {
    const systemPromptFilePath = systemPromptFileArg.substring("--system-prompt-file=".length);
    try {
      if (fs4.existsSync(systemPromptFilePath)) {
        systemPrompt = fs4.readFileSync(systemPromptFilePath, "utf8");
        console.log("Loaded system prompt from file:", systemPromptFilePath, "- Length:", systemPrompt.length);
      } else {
        console.error("System prompt file not found:", systemPromptFilePath);
      }
    } catch (err) {
      console.error("Failed to read system prompt file:", err);
    }
  } else if (systemPromptArg) {
    systemPrompt = systemPromptArg.substring("--system-prompt=".length);
    console.log("Using system prompt from command line - Length:", systemPrompt?.length || 0);
  }
  let imageUrls = [];
  if (imageUrlsArg) {
    try {
      const imageUrlsJson = imageUrlsArg.substring("--image-urls=".length);
      imageUrls = JSON.parse(imageUrlsJson);
      console.log("Parsed", imageUrls.length, "image URLs");
    } catch (err) {
      console.error("Failed to parse --image-urls argument:", err);
    }
  }
  const sessionId = continueArg?.substring("--continue=".length) || void 0;
  return {
    prompt,
    systemPrompt,
    cwd,
    model,
    imageUrls,
    sessionId
  };
}

// src/hooks/convex-deploy.ts
import { exec } from "child_process";
var deployDebounceTimer = null;
var deployInProgress = false;
async function runConvexDeploy(cwd) {
  console.log("Running convex deploy...");
  return new Promise((resolve2) => {
    exec("npx convex deploy --typecheck=disable", { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error("Convex deploy failed:", error.message);
        if (stderr) console.error("stderr:", stderr);
      } else {
        console.log("Convex deploy completed");
        if (stdout) console.log("stdout:", stdout);
      }
      resolve2();
    });
  });
}
function createConvexDeployHook() {
  return async (input, _toolUseID, _options) => {
    console.log("SessionEnd hook triggered - running convex deploy");
    await runConvexDeploy(input.cwd);
    return { continue: true };
  };
}
function createConvexPostToolUseHook() {
  return async (input, _toolUseID, _options) => {
    const toolName = input.tool_name;
    if (toolName !== "Write" && toolName !== "Edit") {
      return { continue: true };
    }
    const toolInput = input.tool_input;
    const filePath = toolInput?.file_path;
    if (!filePath || !filePath.includes("/convex/")) {
      return { continue: true };
    }
    console.log(`[Convex Hook] Convex file changed: ${filePath}`);
    if (deployDebounceTimer) {
      clearTimeout(deployDebounceTimer);
    }
    deployDebounceTimer = setTimeout(async () => {
      if (deployInProgress) {
        console.log("[Convex Hook] Deploy already in progress, skipping");
        return;
      }
      deployInProgress = true;
      try {
        console.log("[Convex Hook] Debounce elapsed, running convex deploy...");
        await runConvexDeploy(input.cwd);
      } finally {
        deployInProgress = false;
      }
    }, 2e3);
    return { continue: true };
  };
}

// src/cli.ts
async function main() {
  console.log("========================================");
  console.log("CAPSULE AGENT CLI");
  console.log("========================================");
  console.log("Raw process.argv:", process.argv);
  try {
    const args = parseArgs(process.argv);
    const withConvexDeploy = process.argv.some((arg) => arg === "--with-convex-deploy");
    const hooks = withConvexDeploy ? {
      onSessionEnd: [createConvexDeployHook()],
      onPostToolUse: [createConvexPostToolUseHook()]
    } : void 0;
    const result = await runExecutor(args, void 0, hooks);
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error("CLI Error:", error);
    process.exit(1);
  }
}
main();
