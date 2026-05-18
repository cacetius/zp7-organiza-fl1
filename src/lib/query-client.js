import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30_000,       // dados ficam "frescos" por 30s — evita refetch a cada navegação
			gcTime: 5 * 60_000,      // cache mantido por 5 min
		},
	},
});