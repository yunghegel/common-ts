
type AuthType = 'basic' | 'jwt' | 'bearer' | 'oauth2' | 'apikey' | 'none' | 'token';
type RequestType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
type AcceptType = 'application/json' | 'application/xml' | 'text/plain' | 'text/html';
type ContentType = 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data';


interface SharedOptions<T extends AuthType> {
    baseurl: string;
    auth: Authentication<T>;
    defaults: {
        'Content-Type': ContentType;
        'Accept': AcceptType;
    };
}

interface RequestOptions {
    endpoint: string;
    method: RequestType;
    headers: Record<string, string>;
    query: Record<string, string>;
    body: Record<string, unknown>;
}

interface Authentication<T extends AuthType> {
    kind: T;
    map: AuthMap[T];
}

type Query = Record<string, string>;

interface APIClient<T extends AuthType = 'none'> {
    sharedOptions: SharedOptions<T>;
    fetch<T>(options: RequestOptions): Promise<T>;
    options(endpoint: string, kind: RequestType, content: ContentType, accept: AcceptType,body: any, query: Query): ReqOpts;
    request<T>(endpoint: string, type: RequestType, accept: AcceptType, response: ResponseType, body: any, query: Query, extraHeaders: any): Promise<T>;
}
type AuthHeaders = {
    basic: {
        Authorization: string;
    };
    jwt: {
        Authorization: string;
    };
    bearer: {
        Authorization: string;
    };
    oauth2: {
        Authorization: string;
    };
    apikey: {
        'x-api-key': string;
    };
    token: {
        'token': string;
    }
    none: {};
};

interface AuthMap {
    basic: {
        username: string;
        password: string;
    };
    jwt: {
        token: string;
    };
    bearer: {
        token: string;
    };
    oauth2: {
        token: string;
    };
    apikey: {
        key: string;
    };
    token: {
        'token': string;
    }
    none: {};
}

type ReqOpts = RequestInit & {
    url: string;
}

// Implementation of the generic API client

export class GenericAPIClient<T extends AuthType = 'none'> implements APIClient<T> {
    public sharedOptions: SharedOptions<T>;
  
    constructor(options: SharedOptions<T>) {
      this.sharedOptions = options;
    }
  
    private getAuthHeaders(): AuthHeaders[T] {
      const { kind, map } = this.sharedOptions.auth;
  
      switch (kind) {
        case 'basic':
          const { username, password } = map as AuthMap['basic'];
          return {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
          } as AuthHeaders[T];
  
        case 'jwt':
        case 'bearer':
          const { token: authToken } = map as AuthMap['jwt'] | AuthMap['bearer'];
          return {
            Authorization: `${kind === 'jwt' ? 'JWT' : 'Bearer'} ${authToken}`
          } as AuthHeaders[T];
  
        case 'oauth2':
          const { token: oauthToken } = map as AuthMap['oauth2'];
          return {
            Authorization: `Bearer ${oauthToken}`
          } as AuthHeaders[T];
  
        case 'apikey':
          const { key } = map as AuthMap['apikey'];
          return {
            'x-api-key': key
          } as AuthHeaders[T];

        case 'token':
            const { 'token': token } = map as AuthMap['token'];
            return {
                'token': token
            } as AuthHeaders[T];
  
        case 'none':
        default:
          return {} as AuthHeaders[T];
      }
    }
  
    public options(
        endpoint: string,
      kind: RequestType,
      content: ContentType = 'application/json',
      accept: AcceptType = 'application/json',
        body: any = {},
        query: Query = {}
    ): ReqOpts {
      const headers: Record<string, string> = {
        'Content-Type': content as string,
        'Accept': accept as string,
        ...this.getAuthHeaders() as Record<string, string>
      };
  
      if (this.sharedOptions.defaults) {
        Object.assign(headers, {
          'Content-Type': this.sharedOptions.defaults['Content-Type'],
          'Accept': this.sharedOptions.defaults['Accept']
        });
      }
  
      return {
        url: this.buildUrl((endpoint), query),
        method: kind,
        headers,
        body: JSON.stringify(body),

      };
    }

    public async doFetch<T>(options: ReqOpts): Promise<T> {
        if (options.method === 'GET') {
            delete options.body;
        }
        const response = await fetch(options.url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return response.json();
        } else if (contentType?.includes('text/plain') || contentType?.includes('text/html')) {
          return response.text() as Promise<T>;
        } else {
          throw new Error(`Unsupported content type: ${contentType}`);
        }
      }
  
    private buildUrl(endpoint: string, query?: Record<string, string>): string {
      const url = new URL(this.sharedOptions.baseurl + endpoint, this.sharedOptions.baseurl);
      
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }
  
      return url.toString();
    }
  
    public async fetch<ResponseType>(options: RequestOptions): Promise<ResponseType> {
      const {
        endpoint,
        method,
        headers = {},
        query = {},
        body
      } = options;
  
        const requestInit: RequestInit = {
            method,
            headers: new Headers(headers)
      };
  
      if (body && Object.keys(body).length > 0) {
        if (requestInit.headers && (requestInit.headers as Record<string, string>)['Content-Type'] === 'application/json') {
          requestInit.body = JSON.stringify(body);
        } else if ((requestInit.headers as Record<string, string>)?.['Content-Type'] === 'application/x-www-form-urlencoded') {
          requestInit.body = new URLSearchParams(body as Record<string, string>).toString();
        } else if (requestInit.headers && (requestInit.headers as Record<string, string>)['Content-Type'] === 'multipart/form-data') {
          const formData = new FormData();
          Object.entries(body).forEach(([key, value]) => {
            formData.append(key, value as string | Blob);
          });
          requestInit.body = formData;
        }
      }
  
      const response = await fetch(this.buildUrl(endpoint, query), requestInit);
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      } else if (contentType?.includes('text/plain') || contentType?.includes('text/html')) {
        return response.text() as Promise<ResponseType>;
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
    }
  
    public async request<ResponseType>(
      endpoint: string,
      type: RequestType = 'GET',
      accept: AcceptType = 'application/json',
      responseType: any = 'json',
      body?: any,
      query?: Record<string, string>,
      extraHeaders?: Record<string, string>
    ): Promise<ResponseType> {
      const options: RequestOptions = {
        endpoint,
        method: type,
        headers: {
          'Accept': accept,
          ...extraHeaders
        },
        query: query || {},
        body: body || {}
      };
  
      return this.fetch<ResponseType>(options);
    }
  }
  
  // Example usage:
  
  const client = new GenericAPIClient<'token'>({
    baseurl: 'https://api.fonestorm.com/v2',
    auth: {
      kind: 'token',
      map: {
        'token': 'eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50Ijp7ImlkIjoiMjAwNTU1MzI2OSIsImVtYWlsIjoiZnJhY3RlbGZvbmUtZGVtbzJAZnJhY3RlbC5jb20ifSwiYXV0aG9yaXphdGlvbiI6eyJhY2Nlc3MiOiJVc2VyIiwiYWNjZXNzX3J1bGVzIjp7InN1YmFjY291bnRzIjoiTm9uZSIsInVzZXJzIjoiTm9uZSIsImJ1c2luZXNzX29iamVjdHMiOiJFZGl0IiwiZm9uZW51bWJlcnMiOiJFZGl0IiwiYmlsbGluZyI6Ik5vbmUiLCJhbmFseXRpY3MiOiJOb25lIn0sInJvbGUiOiJPcmdhbml6YXRpb24ifSwicG9ydGFsIjp7InRva2VuIjoiOTFjOTQ2MWU4ZDZhMTlkYjQxMDlmZjYwZDM1YWFiNTAiLCJleHBpcmVzIjoiMjAyNC0xMS0xNSAyMToyNDo1MyBVVEMiLCJ1cmwiOm51bGx9LCJmcmFjdGVsZm9uZSI6IjU0OTU0MDQ0ODE4NCIsInNlbGZfcHJvdmlzaW9uaW5nIjp0cnVlLCJpbmNsdWRlaW52ZW50b3J5Ijp0cnVlLCJzaG93X21lc3NhZ2luZ19icmFuZHMiOnRydWUsImhpZ2hfdm9sdW1lX21lc3NhZ2luZyI6ZmFsc2UsInN1YiI6IjExNDIiLCJzY3AiOiJ1c2VyIiwiYXVkIjpudWxsLCJpYXQiOjE3MzE2MTkwOTQsImV4cCI6MTczMTcwNTQ5NCwianRpIjoiZGUzYjdkZWYtOTMyZC00YWM2LThjYmQtZTBkNmYwNGFjOTBjIn0.XqjH67bdITA-GxlMnGEFt96t2GkLK9GtpdaD4ohWDY8'
      }
    },
    defaults: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  // Making a request
const options = client.options('/users/fractelfone-demo2@fractel.com','GET', 'application/json', 'application/json', {});

(async function(){
    const response = await client.doFetch(options);
    console.log(response);
    

})()