import {
    ApId,
    assertEqual,
    EndpointScope,
    PlatformWithoutSensitiveData,
    PrincipalType,
    SERVICE_KEY_SECURITY_OPENAPI,
    UpdatePlatformRequestBody,
} from '@activepieces/shared'
import {
    FastifyPluginAsyncTypebox,
    Type,
} from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { platformMustBeOwnedByCurrentUser } from '../ee/authentication/ee-authorization'
import { smtpEmailSender } from '../ee/helper/email/email-sender/smtp-email-sender'
import { platformService } from './platform.service'
import { userService } from '../user/user-service'

export const platformController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/:id', UpdatePlatformRequest, async (req, res) => {
        await platformMustBeOwnedByCurrentUser.call(app, req, res)

        const { smtp } = req.body
        if (smtp) {
            await smtpEmailSender(req.log).validateOrThrow(smtp)
        }

        return platformService.update({
            id: req.params.id,
            ...req.body,
        })
    })

    app.get('/', ListPlatformsForIdentityRequest, async (req) => {
        const userId = await userService.getOneOrFail({ id: req.principal.id })
        const platforms = await platformService.listPlatformsForIdentity({ identityId: userId.identityId })
        return platforms.filter((platform) => !platform.ssoEnabled && !platform.embeddingEnabled)
    })

    app.get('/:id', GetPlatformRequest, async (req) => {
        assertEqual(
            req.principal.platform.id,
            req.params.id,
            'userPlatformId',
            'paramId',
        )
        const platform = await platformService.getOneOrThrow(req.params.id)
        return platform
    })
}

const UpdatePlatformRequest = {
    schema: {
        body: UpdatePlatformRequestBody,
        params: Type.Object({
            id: ApId,
        }),
        response: {
            [StatusCodes.OK]: PlatformWithoutSensitiveData,
        },
    },
}

const ListPlatformsForIdentityRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER],
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        params: Type.Object({}),
        response: {
            [StatusCodes.OK]: Type.Array(PlatformWithoutSensitiveData),
        },
    },
}
const GetPlatformRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE],
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['platforms'],
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        description: 'Get a platform by id',
        params: Type.Object({
            id: ApId,
        }),
        response: {
            [StatusCodes.OK]: PlatformWithoutSensitiveData,
        },
    },
}
