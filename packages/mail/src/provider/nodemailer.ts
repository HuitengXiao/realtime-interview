import { config } from "@repo/config";
import nodemailer from "nodemailer";
import type { SendEmailHandler } from "../../types";

const { from } = config.mails;

type MailEnvironment = {
	MAIL_HOST?: string;
	MAIL_PASS?: string;
	MAIL_PORT?: string;
	MAIL_USER?: string;
};

/**
 * Nodemailer uses an implicit TLS connection on port 465. SMTP submission
 * ports such as 587 negotiate TLS with STARTTLS after connecting.
 */
export function smtpTransportOptions(
	environment: MailEnvironment = {
		MAIL_HOST: process.env.MAIL_HOST,
		MAIL_PORT: process.env.MAIL_PORT,
		MAIL_USER: process.env.MAIL_USER,
		MAIL_PASS: process.env.MAIL_PASS,
	},
) {
	const port = Number(environment.MAIL_PORT ?? "587");

	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("MAIL_PORT must be a valid SMTP port");
	}

	if (!environment.MAIL_HOST) {
		throw new Error("MAIL_HOST is required to send email");
	}

	return {
		host: environment.MAIL_HOST,
		port,
		secure: port === 465,
		requireTLS: port !== 465,
		auth: {
			user: environment.MAIL_USER ?? "",
			pass: environment.MAIL_PASS ?? "",
		},
	};
}

function smtpFromAddress(value: string) {
	// dotenv preserves a `# ...` comment inside quotes. Do not send that text as
	// part of the RFC 5322 address when an existing local environment uses it.
	return value.replace(/\s+#.*$/, "").trim();
}

export const send: SendEmailHandler = async ({ to, subject, text, html }) => {
	const transporter = nodemailer.createTransport(smtpTransportOptions());

	await transporter.sendMail({
		to,
		from: smtpFromAddress(from),
		subject,
		text,
		html,
	});
};
