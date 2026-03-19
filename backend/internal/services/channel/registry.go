package channel

import "fmt"

type Registry struct {
	providers map[string]Provider
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
	}
}

func (r *Registry) Register(provider Provider) {
	r.providers[provider.GetType()] = provider
}

func (r *Registry) Get(channelType string) (Provider, error) {
	p, ok := r.providers[channelType]
	if !ok {
		return nil, fmt.Errorf("unsupported channel type: %s", channelType)
	}
	return p, nil
}

func (r *Registry) List() []string {
	types := make([]string, 0, len(r.providers))
	for t := range r.providers {
		types = append(types, t)
	}
	return types
}
