import { z } from "zod";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  Base64URLString,
} from "@simplewebauthn/types";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid email",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid email");
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user) {
    throw Errors.notFound("User");
  }

  const passkeys = await prisma.publickeycreds.findMany({
    where: { passkey_user_id: user.id },
  });
  const config = useRuntimeConfig();
  const rpID: string =
    typeof config.public.RPID === "string" && config.public.RPID.length > 0
      ? config.public.RPID
      : "localhost";

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((pk) => ({
      id: pk.id as Base64URLString,
      transports: [] as AuthenticatorTransportFuture[],
    })),
  });

  const session = event.context.session;
  if (session) {
    session.challenge = options.challenge;
    session.email = parsed.email;
  }

  return success({ options });
});
