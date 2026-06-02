package channel

import (
	"fmt"
	"sync"
)

type ProviderFactory func(config map[string]string) Provider

type Registry struct {
	mu        sync.RWMutex
	providers map[string]Provider
	factories map[string]ProviderFactory
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
		factories: make(map[string]ProviderFactory),
	}
}

func (r *Registry) Register(provider Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[provider.GetType()] = provider
}

func (r *Registry) RegisterFactory(channelType string, factory ProviderFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[channelType] = factory
}

func (r *Registry) Get(channelType string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[channelType]
	if !ok {
		return nil, fmt.Errorf("unsupported channel type: %s", channelType)
	}
	return p, nil
}

// CreateProvider creates a new provider with the given credentials
func (r *Registry) CreateProvider(channelType string, creds map[string]string) Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if factory, ok := r.factories[channelType]; ok {
		return factory(creds)
	}
	// Fallback to registered static provider
	if p, ok := r.providers[channelType]; ok {
		return p
	}
	return nil
}

func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	types := make([]string, 0, len(r.providers)+len(r.factories))
	for t := range r.providers {
		types = append(types, t)
	}
	for t := range r.factories {
		if _, exists := r.providers[t]; !exists {
			types = append(types, t)
		}
	}
	return types
}
