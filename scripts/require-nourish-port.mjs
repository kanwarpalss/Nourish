import { createServer } from "node:net";

const port = 3902;

try {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(new Error(`Nourish will not start: its dedicated port ${port} is already in use. Stop the conflicting app instead of changing Nourish's port.`));
        return;
      }
      reject(error);
    });
    server.listen({ host: "0.0.0.0", port, exclusive: true }, () => {
      server.close(resolve);
    });
  });
  console.log(`Nourish port ${port} is reserved and ready.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Nourish could not reserve its dedicated port.");
  process.exitCode = 1;
}
