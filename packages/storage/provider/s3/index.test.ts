import assert from "node:assert/strict";
import test from "node:test";
import { resolveS3Configuration } from "./index";

const credentials = {
	S3_ACCESS_KEY_ID: "test-key",
	S3_SECRET_ACCESS_KEY: "test-secret",
};

test("normalizes an S3 endpoint and preserves the legacy path-style default", () => {
	const configuration = resolveS3Configuration({
		...credentials,
		S3_ENDPOINT: "objects.example.com/",
		S3_REGION: "example-region",
	});

	assert.equal(configuration.endpoint, "https://objects.example.com");
	assert.equal(configuration.region, "example-region");
	assert.equal(configuration.forcePathStyle, true);
});

test("supports explicit virtual-host style", () => {
	const configuration = resolveS3Configuration({
		...credentials,
		S3_ENDPOINT: "https://s3.example.com",
		S3_FORCE_PATH_STYLE: "false",
	});

	assert.equal(configuration.forcePathStyle, false);
});

test("rejects an invalid path-style value", () => {
	assert.throws(
		() =>
			resolveS3Configuration({
				...credentials,
				S3_ENDPOINT: "https://s3.example.com",
				S3_FORCE_PATH_STYLE: "yes",
			}),
		/S3_FORCE_PATH_STYLE must be either true or false/,
	);
});
