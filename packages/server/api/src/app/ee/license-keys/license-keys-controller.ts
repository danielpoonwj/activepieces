import { AppSystemProp } from '@activepieces/server-shared'
import { ActivepiecesError, ErrorCode, isNil, PrincipalType, VerifyLicenseKeyRequestBody } from '@activepieces/shared'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { StatusCodes } from 'http-status-codes'
import { system } from '../../helper/system/system'
import { platformService } from '../../platform/platform.service'
import { licenseKeysService } from './license-keys-service'
import { licenseKeysTrialService } from './license-keys-trial.service'

const key = system.get<string>(AppSystemProp.LICENSE_KEY)

export const licenseKeysController: FastifyPluginAsyncTypebox = async (app) => {

    app.post('/generate-trial-key', GenerateTrialRequest, async (req, res) => {
        const { email, selfHosting, ultimatePlan } = req.body as { email: string, selfHosting: boolean, ultimatePlan: boolean }
        const { message } = await licenseKeysTrialService(req.log).requestTrial({ email, selfHosting, ultimatePlan })
        return res.status(StatusCodes.OK).send({ message })
    })

    app.post('/extend-trial', ExtendTrialRequest, async (req, res) => {
        const { email, days } = req.body as { email: string, days: number }
        await licenseKeysTrialService(req.log).extendTrial({ email, days })
        return res.status(StatusCodes.OK).send({
            message: 'Trial extended',
        })
    })

    app.get('/status', async (_req, res) => {
        const licenseKey = await licenseKeysService(app.log).getKey(key)
        if (isNil(licenseKey)) {
            return res.status(StatusCodes.NOT_FOUND).send({
                message: 'No license key found',
            })
        }
        return licenseKey
    })

    app.get('/:licenseKey', GetLicenseKeyRequest, async (req) => {
        const licenseKey = await licenseKeysService(app.log).getKey(req.params.licenseKey)
        return licenseKey
    })

    app.post('/verify', VerifyLicenseKeyRequest, async (req) => {
        const { platformId, licenseKey } = req.body
        const key = await licenseKeysService(app.log).verifyKeyOrReturnNull({
            platformId,
            license: licenseKey,
        })
        if (isNil(key)) {
            throw new ActivepiecesError({
                code: ErrorCode.INVALID_LICENSE_KEY,
                params: {
                    key: licenseKey,
                },
            })
        }
        await platformService.update({
            id: platformId,
            licenseKey: key.key,
        })
        await licenseKeysService(app.log).applyLimits(platformId, key)
        return key
    })

}

const GenerateTrialRequest = {
    schema: {
        body: {
            type: 'object',
            properties: {
                email: { type: 'string' },
                selfHosting: { type: 'boolean' },
                plan: { type: 'string' },
            },
            required: ['email', 'selfHosting', 'plan'],
        },
    },
    config: {
        // allowedPrincipals: [PrincipalType.SUPER_USER],
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE],
    },
}

const ExtendTrialRequest = {
    schema: {
        body: {
            type: 'object',
            properties: {
                email: { type: 'string' },
                days: { type: 'number' },
            },
        },
    },
    config: {
        // allowedPrincipals: [PrincipalType.SUPER_USER],
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE],
        // scope: EndpointScope.PLATFORM,
    },
}

const VerifyLicenseKeyRequest = {
    config: {
        allowedPrincipals: [
            PrincipalType.UNKNOWN,
            PrincipalType.USER,
        ],
    },
    schema: {
        body: VerifyLicenseKeyRequestBody,
    },
}

const GetLicenseKeyRequest = {
    config: {
        allowedPrincipals: [
            PrincipalType.UNKNOWN,
            PrincipalType.USER,
        ],
    },
    schema: {
        params: Type.Object({
            licenseKey: Type.String(),
        }),
    },
}