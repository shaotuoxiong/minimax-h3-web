import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from aliyun_ddns import choose_record, update_dns
from direct_gateway import GatewayError


class AliyunDDNSTest(unittest.TestCase):
    def test_only_exact_h3_a_record_is_selected_and_ambiguous_updates_are_rejected(self):
        unrelated = SimpleNamespace(rr="mail", type="A")
        ipv6 = SimpleNamespace(rr="h3", type="AAAA")
        target = SimpleNamespace(rr="h3", type="A")
        self.assertIs(choose_record([unrelated, ipv6, target], "h3"), target)
        with self.assertRaises(GatewayError):
            choose_record([target, target], "h3")

    def test_dns_updates_only_when_router_address_changes(self):
        record = SimpleNamespace(rr="h3", type="A", value="183.159.230.119", record_id="123")
        client = Mock()
        client.describe_domain_records.return_value = SimpleNamespace(body=SimpleNamespace(total_count=1, domain_records=SimpleNamespace(record=[record])))
        with patch.dict(os.environ, {"Ali_Key": "test-key", "Ali_Secret": "test-secret"}), patch('alibabacloud_alidns20150109.client.Client', return_value=client):
            self.assertEqual(update_dns("yakiyyy.online", "h3", record.value), "unchanged")
            client.update_domain_record.assert_not_called()
            self.assertEqual(update_dns("yakiyyy.online", "h3", "183.159.230.120"), "updated")
            request = client.update_domain_record.call_args.args[0]
            self.assertEqual((request.record_id, request.rr, request.type, request.value), ("123", "h3", "A", "183.159.230.120"))
            client.add_domain_record.assert_not_called()

    def test_missing_a_record_is_created_for_selected_domain(self):
        client = Mock()
        client.describe_domain_records.return_value = SimpleNamespace(body=SimpleNamespace(total_count=0, domain_records=SimpleNamespace(record=[])))
        with patch.dict(os.environ, {"Ali_Key": "test-key", "Ali_Secret": "test-secret"}), patch('alibabacloud_alidns20150109.client.Client', return_value=client):
            self.assertEqual(update_dns("yakiyyy.online", "h3", "183.159.230.119"), "created")
            request = client.add_domain_record.call_args.args[0]
            self.assertEqual((request.domain_name, request.rr, request.type, request.value), ("yakiyyy.online", "h3", "A", "183.159.230.119"))
            client.update_domain_record.assert_not_called()
