import assert from "node:assert/strict";
import test from "node:test";
import { smtpTransportOptions } from "../src/provider/nodemailer";
import { sendEmail } from "../src/util/send";

test("SMTP port 465 uses implicit TLS", () => {
	const options = smtpTransportOptions({
		MAIL_HOST: "smtp.example.com",
		MAIL_PORT: "465",
		MAIL_USER: "user",
		MAIL_PASS: "pass",
	});

	assert.equal(options.secure, true);
	assert.equal(options.requireTLS, false);
});

test("SMTP submission ports use STARTTLS", () => {
	const options = smtpTransportOptions({
		MAIL_HOST: "smtp.example.com",
		MAIL_PORT: "587",
	});

	assert.equal(options.secure, false);
	assert.equal(options.requireTLS, true);
});

test("SMTP configuration rejects an invalid port", () => {
	assert.throws(
		() =>
			smtpTransportOptions({
				MAIL_HOST: "smtp.example.com",
				MAIL_PORT: "0",
			}),
		/MAIL_PORT/,
	);
});

test("sendEmail propagates delivery errors", async () => {
	const deliveryError = new Error("SMTP rejected message");

	await assert.rejects(
		sendEmail(
			{ to: "person@example.com", subject: "Subject" },
			async () => {
				throw deliveryError;
			},
		),
		(error: unknown) => error === deliveryError,
	);
});
