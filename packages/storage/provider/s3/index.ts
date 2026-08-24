import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@repo/logs";
import type {
	GetSignedUploadUrlHandler,
	GetSignedUrlHander,
} from "../../types";

let s3Client: S3Client | null = null;

interface StorageEnvironment {
	[key: string]: string | undefined;
	S3_ENDPOINT?: string;
	S3_REGION?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_SECRET_ACCESS_KEY?: string;
	S3_FORCE_PATH_STYLE?: string;
}

export function resolveS3Configuration(
	environment: StorageEnvironment = process.env,
) {
	const rawEndpoint = environment.S3_ENDPOINT?.trim().replace(/\/+$/, "");
	if (!rawEndpoint) {
		throw new Error("Missing env variable S3_ENDPOINT");
	}
	const endpoint = /^https?:\/\//.test(rawEndpoint)
		? rawEndpoint
		: `https://${rawEndpoint}`;

	const accessKeyId = environment.S3_ACCESS_KEY_ID;
	if (!accessKeyId) {
		throw new Error("Missing env variable S3_ACCESS_KEY_ID");
	}

	const secretAccessKey = environment.S3_SECRET_ACCESS_KEY;
	if (!secretAccessKey) {
		throw new Error("Missing env variable S3_SECRET_ACCESS_KEY");
	}

	const pathStyleValue = environment.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
	if (pathStyleValue && !["true", "false"].includes(pathStyleValue)) {
		throw new Error("S3_FORCE_PATH_STYLE must be either true or false");
	}

	return {
		region: environment.S3_REGION || "auto",
		endpoint,
		forcePathStyle: pathStyleValue === undefined ? true : pathStyleValue === "true",
		credentials: { accessKeyId, secretAccessKey },
	};
}

const getS3Client = () => {
	if (s3Client) {
		return s3Client;
	}

	const configuration = resolveS3Configuration();

	s3Client = new S3Client({
		...configuration,
	});

	return s3Client;
};

export const getSignedUploadUrl: GetSignedUploadUrlHandler = async (
	path,
	{ bucket },
) => {
	const s3Client = getS3Client();
	try {
		return await getS3SignedUrl(
			s3Client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: path,
				ContentType: "image/jpeg",
			}),
			{
				expiresIn: 60,
			},
		);
	} catch (e) {
		logger.error(e);

		throw new Error("Could not get signed upload url");
	}
};

export const getSignedUrl: GetSignedUrlHander = async (
	path,
	{ bucket, expiresIn },
) => {
	const s3Client = getS3Client();
	try {
		return getS3SignedUrl(
			s3Client,
			new GetObjectCommand({ Bucket: bucket, Key: path }),
			{ expiresIn },
		);
	} catch (e) {
		logger.error(e);
		throw new Error("Could not get signed url");
	}
};
