import os

# Guard must never hit the network in tests.
os.environ.setdefault("PADTAR_SKIP_ACCESS_CHECK", "1")
