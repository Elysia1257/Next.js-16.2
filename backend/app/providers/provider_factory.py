from typing import Optional

from app.providers.base import BaseProvider
from app.providers.mock_provider import MockProvider
from app.providers.vidu_provider import ViduProvider

_provider_registry: dict[str, BaseProvider] = {
    "mock": MockProvider(),
    "vidu": ViduProvider(),
}


def get_provider(provider_name: str) -> Optional[BaseProvider]:
    """Return a provider instance by name, or `None` if unknown."""
    return _provider_registry.get(provider_name)


def register_provider(name: str, provider: BaseProvider) -> None:
    """Register a new provider instance (useful for testing)."""
    _provider_registry[name] = provider


def list_providers() -> list[str]:
    """Return the names of all currently registered providers."""
    return list(_provider_registry.keys())



def clear_providers() -> None:
    """Reset the provider registry to defaults (useful in test teardown)."""
    _provider_registry.clear()
    _provider_registry["mock"] = MockProvider()
