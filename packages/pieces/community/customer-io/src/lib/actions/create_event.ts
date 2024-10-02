import { createAction, DynamicPropsValue, Property } from '@activepieces/pieces-framework';
import { customerIOAuth } from '../../index';
import { customerIOCommon } from '../common';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';

export const createEvent = createAction({
  auth: customerIOAuth,
  name: 'create_event',
  displayName: 'Create Event',
  description: 'Create an event in Customer.io',
  props: {
    customer_email: Property.ShortText({
      displayName: 'Customer Email',
      description: 'Customer Email',
      required: true,
    }),
    event_name: Property.ShortText({
      displayName: 'Event Name',
      description: 'Event Name',
      required: true,
    }),
    body_type: Property.StaticDropdown({
      displayName: 'parameters',
      required: false,
      description: 'Event information to be sent to Customer.io',
      defaultValue: 'key_value',
      options: {
        disabled: false,
        options: [
          {
            label: 'Key Value',
            value: 'key_value',
          },
          {
            label: 'JSON',
            value: 'json',
          },
        ],
      },
    }),
    body: Property.DynamicProperties({
      displayName: 'Body',
      refreshers: ['body_type'],
      required: false,
      props: async ({ body_type }) => {
        if (!body_type) return {};

        const bodyTypeInput = body_type as unknown as string;

        const fields: DynamicPropsValue = {};

        switch (bodyTypeInput) {
          case 'json':
            fields['data'] = Property.Json({
              displayName: 'JSON Body',
              required: true,
            });
            break;
          case 'key_value':
            fields['data'] = Property.Object({
              displayName: 'Key Value',
              required: true,
            });
            break;
        }
        return fields;
      },
    }),
  },
  async run(context) {
    const {
      body,
      body_type,
    } = context.propsValue;

    const basic_track_api = `${
      Buffer.from(
        `${context.auth.track_site_id}:${context.auth.track_api_key}`,
        'utf8'
      ).toString('base64')
    }`

    const headers = {
      Authorization: `Basic ${basic_track_api}`,
      'Content-Type': 'application/json',
    }
    const encoded_email = encodeURIComponent(context.propsValue.customer_email);
    const url = customerIOCommon[context.auth.region || 'us'].trackUrl + 'customers/' + encoded_email + '/events';

    const httprequestdata = {
      method: HttpMethod.POST,
      url,
      headers,
      body: {
        name: context.propsValue.event_name,
        id: context.propsValue.customer_email,
        data: body ? body['data'] : {},
      },
    }
    return await httpClient.sendRequest(httprequestdata);
  },
})
