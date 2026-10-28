import copy
import unittest
from io import BytesIO
from unittest.mock import Mock

from direct_gateway import DESCRIPTION, Gateway, GatewayError


class MemoryGateway(Gateway):
    def __init__(self, mapping):
        self.mapping = copy.deepcopy(mapping)
        self.renewals = 0

    def call(self, action, **arguments):
        if action == "GetSpecificPortMappingEntry":
            return self.mapping
        if action == "AddPortMapping":
            self.renewals += 1
            self.mapping = {key: str(value) for key, value in arguments.items()}
            return {}
        raise AssertionError("Unexpected gateway action")


class DirectGatewayTest(unittest.TestCase):
    def test_owned_mapping_can_be_created_and_renewed_without_permanent_lease(self):
        gateway = MemoryGateway(None)
        for _ in range(2):
            mapping = gateway.ensure_mapping("192.168.1.47", 47863, 8443)
            self.assertEqual(mapping["NewInternalPort"], "8443")
            self.assertEqual(mapping["NewLeaseDuration"], "600")
        self.assertEqual(gateway.renewals, 2)

    def test_existing_other_application_mapping_is_preserved(self):
        for field, value in [("NewPortMappingDescription", "other application"), ("NewInternalClient", "192.168.1.99"), ("NewInternalPort", "9000")]:
            with self.subTest(field=field):
                original = {"NewInternalClient": "192.168.1.47", "NewInternalPort": "8443", "NewPortMappingDescription": DESCRIPTION}
                original[field] = value
                gateway = MemoryGateway(original)
                with self.assertRaises(GatewayError):
                    gateway.ensure_mapping("192.168.1.47", 47863, 8443)
                self.assertEqual(gateway.mapping, original)
                self.assertEqual(gateway.renewals, 0)

    def test_successful_mutation_accepts_huawei_unbound_prefix_response(self):
        gateway = Gateway.__new__(Gateway)
        gateway.service_type = "urn:schemas-upnp-org:service:WANIPConnection:1"
        gateway.control_url = "http://192.168.1.1/control"
        gateway.opener = Mock()
        gateway.opener.open.return_value = BytesIO(b'<u:DeletePortMappingResponse/>')
        self.assertEqual(gateway.call("DeletePortMapping", NewExternalPort=47863), {})
